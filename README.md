# Delfos

Plataforma de consulta em linguagem natural sobre bancos de dados federados. O usuário escreve a
pergunta em português, um LLM traduz para SQL usando contexto recuperado por RAG, o SQL é validado
e executado no **Trino**, que federa Supabase (PostgreSQL) e MongoDB Atlas.

```
┌──────────────┐      ┌───────────────────┐      ┌──────────────────────┐
│  frontend    │─────▶│  delfos-backend   │─────▶│  rag_orchestrator    │
│  Next.js 16  │ HTTP │  NestJS 11        │ HTTP │  FastAPI + Weaviate  │
│  :3000       │      │  :3001            │      │  :8001 (7860 Docker) │
└──────────────┘      └─────────┬─────────┘      └──────────────────────┘
                                │                          ▲
                       ┌────────┴────────┐                 │ embeddings
                       │                 │                 │ (sentence-transformers)
                       ▼                 ▼
              ┌─────────────────┐  ┌──────────────┐
              │  OpenRouter     │  │  Trino 450   │
              │  (tradução NL→  │  │  :8443 HTTPS │
              │   SQL)          │  └──────┬───────┘
              └─────────────────┘         │
                                ┌─────────┴──────────┐
                                ▼                    ▼
                       Supabase (Postgres)    MongoDB Atlas
                       schema por banco       db_telemetria
```

## Componentes

| Diretório | Stack | Porta | Papel |
|---|---|---|---|
| [`frontend/`](frontend) | Next.js 16, React 19, Ant Design 6, ReactFlow | 3000 | UI: login, dashboard, consultas, resultados, histórico, diagrama de schemas |
| [`delfos-backend/`](delfos-backend) | NestJS 11, TypeORM, Redis, Passport JWT | 3001 | Auth, tradução NL→SQL, validação, execução, histórico, sync de schemas |
| [`rag_orchestrator/`](rag_orchestrator) | FastAPI, Weaviate, sentence-transformers | 8001 | Contexto RAG: schemas por tabela, expansão por FK, queries validadas |
| [`trino/`](trino) | Trino 450 em Docker | 8443 | Federação SQL sobre Supabase + MongoDB Atlas |

### Infraestrutura (Docker Compose próprio em cada diretório)

| Diretório | Serviço | Porta (host) | Papel |
|---|---|---|---|
| [`postgresql/`](postgresql) | PostgreSQL 16 | **5442** | Banco operacional: schema `delfos` com `users`, `query_history`, `database_connections`, `audit_log` |
| [`redis/`](redis) | Redis 7 | 6379 | Sessões (`delfos:sess:{userId}`), AOF habilitado |
| [`weaviate/`](weaviate) | Weaviate | 8080 REST + 50051 gRPC | Vector store do RAG (`database_schemas`, `validated_queries`) |

### Serviços externos

- **OpenRouter** — provedor do LLM tradutor
- **Supabase + MongoDB Atlas** — bancos-alvo consultados pelo Trino

## Pré-requisitos

- Node.js **22.x** (backend) / 20+ (frontend)
- Python **3.11**
- Docker + Docker Compose
- Contas: OpenRouter, Supabase, MongoDB Atlas

---

## Ordem de subida recomendada

```
1. PostgreSQL + Redis + Weaviate  (infra)
2. Trino                          (federação — pode ser remoto)
3. rag_orchestrator               (:8001)
4. delfos-backend                 (:3001)
5. frontend                       (:3000)
```

---

## 1. Infraestrutura local (Postgres, Redis, Weaviate)

Cada serviço tem seu próprio diretório e compose. Suba os três antes do resto.

### 1.1 PostgreSQL — [`postgresql/`](postgresql)

```bash
cd postgresql
cp .env.example .env            # defaults funcionam em dev
docker compose up -d
docker compose ps               # aguardar status "healthy"
```

| Item | Valor |
|---|---|
| Imagem | `postgres:16-alpine` |
| Container | `delfos-postgres` |
| Porta **host** | **5442** → 5432 no container |
| Banco / usuário | `delfos` / `delfos_user` |
| Volume | `delfos-postgres-data` |
| Rede | `delfos-network` |

> ⚠️ A porta do host é **5442**, não 5432 — evita conflito com um Postgres já instalado na
> máquina. O `delfos-backend/.env` precisa de `POSTGRES_PORT=5442`. O `.env.example` do backend
> ainda traz `5432`; corrija ao copiar.

Os scripts em `init-scripts/` rodam **só na primeira criação do volume**:

| Script | Efeito |
|---|---|
| `01-init-database.sql` | Extensões `uuid-ossp` e `pgcrypto`, schema `delfos`, `search_path` |
| `02-create-tables.sql` | `users`, `query_history`, `database_connections`, `audit_log` + índices |
| `03-create-admin-user.sql` | Admin inicial a partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD` — **vazios = nenhum admin criado** |

Para reexecutar os scripts é preciso recriar o volume: `docker compose down -v && docker compose up -d`
(**apaga todos os dados**).

**Admin inicial** — não há credencial padrão. Preencha no `postgresql/.env` **antes** da primeira
subida:

```
ADMIN_EMAIL=admin@delfos.local
ADMIN_PASSWORD=<senha forte>
```

Vazios (o default) = nenhum admin criado; registre o primeiro usuário via
`POST /api/auth/register`. O hash bcrypt é gerado pelo `pgcrypto` dentro do banco — a senha em
claro não é persistida.

Com o volume já criado, trocar a senha sem derrubar o banco:

```bash
docker compose exec postgres psql -U delfos_user -d delfos \
  -c "UPDATE delfos.users SET password_hash = crypt('<nova-senha>', gen_salt('bf')) WHERE email = '<email>';"
```

Conectar via CLI:

```bash
docker compose exec postgres psql -U delfos_user -d delfos -c "\dt delfos.*"
```

### 1.2 Redis — [`redis/`](redis)

```bash
cd redis
cp .env.example .env
docker compose up -d
docker compose exec redis redis-cli ping        # PONG
```

| Item | Valor |
|---|---|
| Imagem | `redis:7-alpine` |
| Container | `delfos-redis` |
| Porta | 6379 |
| Persistência | AOF habilitado (`redis.conf`) |
| Eviction | `allkeys-lru`, `maxmemory` 256MB |
| Senha | vazia em dev — definir `requirepass` no `redis.conf` em produção |

Sessões ficam em `delfos:sess:{userId}`:

```bash
docker compose exec redis redis-cli KEYS "delfos:sess:*"
```

### 1.3 Weaviate — [`weaviate/`](weaviate)

Vector store do RAG. Dois composes: local e EC2.

A API key dos dois composes vem de `weaviate/.env` (não versionado), via `WEAVIATE_API_KEY`:

```bash
cd weaviate
cp .env.example .env
openssl rand -base64 32         # valor de WEAVIATE_API_KEY
```

O mesmo valor precisa ir para `rag_orchestrator/.env` → `VECTOR_STORE_API_KEY`. Cada ambiente tem
seu próprio `.env` — a key da EC2 não é a mesma do local.

**Local** ([`docker-compose.yaml`](weaviate/docker-compose.yaml)):

```bash
cd weaviate
docker compose up -d
```

| Item | Valor |
|---|---|
| Imagem | `cr.weaviate.io/semitechnologies/weaviate:latest` |
| REST | 8080 |
| gRPC | 50051 — **obrigatório**, o cliente Weaviate v4 usa REST *e* gRPC |
| Auth | API key (`WEAVIATE_API_KEY`), usuário `rag_orchestrator`; acesso anônimo desligado |
| Vetorizador | `none` |

`DEFAULT_VECTORIZER_MODULE=none` porque o embedding é gerado **no rag_orchestrator**
(`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`), não pelo Weaviate. O mesmo modelo
precisa ser usado em insert e search, senão a busca semântica degrada.

No `rag_orchestrator/.env`: `VECTOR_STORE_URL=http://localhost:8080` e `VECTOR_STORE_API_KEY` = o
valor de `WEAVIATE_API_KEY`.

**EC2** ([`docker-compose.ec2.yaml`](weaviate/docker-compose.ec2.yaml)) — roda na **mesma VM do
Trino**. Motivo: o Weaviate Cloud free limita a 1 collection e o RAG precisa de duas
(`database_schemas` + `validated_queries`).

```bash
docker compose -f docker-compose.ec2.yaml up -d
docker compose -f docker-compose.ec2.yaml logs -f
```

Diferenças em relação ao local:

| Item | Valor |
|---|---|
| Imagem | pinada em `1.28.2` (evita surpresa do `:latest`) |
| REST | **8090** no host → 8080 no container (não colide com o Trino) |
| gRPC | 50051 |
| `mem_limit` | `1500m` + `LIMIT_RESOURCES=true` — protege a RAM do host (Trino usa heap 5G) |

Antes de subir: liberar `8090/tcp` e `50051/tcp` no Security Group da EC2, criar o `.env` **na
própria EC2** com uma key forte e espelhar em `VECTOR_STORE_API_KEY` no RAG.

Os composes falham cedo se a variável estiver ausente (`${WEAVIATE_API_KEY:?...}`) — sem key
silenciosamente vazia.

---

## 2. RAG Orchestrator

```bash
cd rag_orchestrator

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp env.example .env             # ajustar VECTOR_STORE_URL se Weaviate não for localhost:8080

python src/main.py              # sobe em http://0.0.0.0:8001
```

- Docs: `http://localhost:8001/docs`
- Health: `http://localhost:8001/health`

### Variáveis principais (`.env`)

| Var | Padrão | Descrição |
|---|---|---|
| `VECTOR_STORE_URL` | `http://localhost:8080` | URL REST do Weaviate (`http://<EC2>:8090` no deploy) |
| `VECTOR_STORE_API_KEY` | — | Precisa bater com `AUTHENTICATION_APIKEY_ALLOWED_KEYS` do compose do Weaviate |
| `SCHEMA_COLLECTION` | `database_schemas` | Coleção de schemas (nível catálogo, legado) |
| `QUERY_COLLECTION` | `validated_queries` | Coleção de queries validadas |
| `EMBEDDING_MODEL_NAME` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Modelo de embedding |
| `EMBEDDING_DEVICE` | `cpu` | `cpu` ou `cuda` |
| `DEFAULT_MIN_RELEVANCE_SCORE` | `0.6` | Score mínimo para incluir query exemplo |

Há mais defaults declarados só em [`src/config/settings.py`](rag_orchestrator/src/config/settings.py)
(expansão por FK): `FK_EXPANSION_DEPTH=2`, `TOP_K_TABLES=8`, `MAX_TABLES_AFTER_EXPANSION=30`,
`MIN_TABLE_SIMILARITY_SCORE=0.3`, `SCHEMA_TABLES_COLLECTION=schema_tables`.

### Endpoints

| Método | Rota | Uso |
|---|---|---|
| `POST` | `/api/v1/context` | Retorna contexto (tabelas + queries exemplo) para uma pergunta |
| `POST` | `/api/v1/schemas` | Indexa schema de um banco |
| `PUT` | `/api/v1/schemas/{database_id}` | Atualiza schema indexado |
| `GET` | `/api/v1/queries/history` | Histórico de consultas por usuário |
| `POST` | `/api/v1/queries/validate` | Marca query como validada (aprendizado) |

### Testes

```bash
cd rag_orchestrator
pytest
```

### Docker

O [`Dockerfile`](rag_orchestrator/Dockerfile) instala torch CPU-only, faz *bake* do modelo de
embedding no build (sem download em runtime) e expõe a **7860** (padrão Hugging Face Spaces):

```bash
cd rag_orchestrator
docker build -t delfos-rag .
docker run -p 8001:7860 --env-file .env delfos-rag
```

---

## 3. Backend (NestJS)

```bash
cd delfos-backend

npm install
cp .env.example .env            # ajustar OPENROUTER_API_KEY, TRINO_*, JWT_SECRET

npm run start:dev               # watch mode
```

- API: `http://localhost:3001`
- Swagger: `http://localhost:3001/api/docs`

### Variáveis (`.env`)

| Grupo | Vars |
|---|---|
| Server | `PORT=3001`, `NODE_ENV` |
| Postgres | `POSTGRES_HOST/PORT/DB/USER/PASSWORD`, `DB_SCHEMA=delfos` — **`POSTGRES_PORT=5442`** no Docker local |
| Redis | `REDIS_HOST/PORT/PASSWORD/DB`, `REDIS_TLS`, `SESSION_TTL`, `SESSION_PREFIX` |
| JWT | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| CORS | `CORS_ORIGIN=http://localhost:3000` |
| OpenRouter | `OPENROUTER_API_KEY`, `OPENROUTER_DEFAULT_MODEL`, `OPENROUTER_TEMPERATURE`, `OPENROUTER_MAX_TOKENS` |
| Trino | `TRINO_URL`, `TRINO_USER`, `TRINO_PASSWORD`, `TRINO_CATALOG`, `TRINO_TIMEOUT`, `TRINO_TLS_INSECURE`, `TRINO_SOCKS_PROXY` |
| RAG | `RAG_ORCHESTRATOR_URL=http://localhost:8001`, `RAG_ORCHESTRATOR_TIMEOUT`, `RAG_REGISTER_EXECUTED_QUERIES` |

Notas:

- `POSTGRES_PORT=5442` com o compose de [`postgresql/`](postgresql) — o `.env.example` traz `5432`, que só serve para um Postgres publicado na porta padrão.
- `REDIS_TLS=true` para Redis gerenciado (Upstash, Redis Cloud). Vazio no Docker local.
- `TRINO_TLS_INSECURE=true` aceita o certificado self-signed da VM. Use vazio quando o Trino for local sem TLS.
- `TRINO_SOCKS_PROXY` é legado do acesso via Tailscale — deixe **vazio** com a exposição HTTPS direta.
- `OPENROUTER_DEFAULT_MODEL` com sufixo `:free` funciona com a política "Free model publication". Para modelos pagos, ajustar em https://openrouter.ai/settings/privacy.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Registro |
| `POST` | `/api/auth/login` | Login (retorna JWT) |
| `GET` | `/api/auth/validate` | Valida sessão (Bearer) |
| `POST` | `/api/auth/logout` | Logout (invalida sessão no Redis) |
| `POST` | `/api/delfos/translate` | Pergunta em NL → SQL |
| `POST` | `/api/delfos/validate-edit` | Valida SQL editado pelo usuário |
| `POST` | `/api/delfos/execute` | Executa SQL no Trino |
| `POST` | `/api/delfos/mark-success` | Marca consulta como bem-sucedida (feed do RAG) |
| `GET` | `/api/delfos/query-history` | Histórico do usuário |
| `POST` | `/api/query-broker/analyze` | Análise/roteamento da consulta |
| `GET` | `/api/schemas` | Lista schemas conhecidos |
| `POST` | `/api/schemas/sync` | Sincroniza schemas do Trino para o RAG |
| `POST` | `/api/schemas/dependency-graph` | Grafo de dependências (FK) |

Smoke test:

```bash
curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d '{"email":"teste@example.com","password":"senha123","passwordConfirmation":"senha123","name":"Usuário Teste"}'
```

### Scripts

| Comando | Efeito |
|---|---|
| `npm run start:dev` | Dev com watch |
| `npm run build` | Compila para `dist/` |
| `npm run start:prod` | Roda `dist/main` |
| `npm test` | Jest (unitários) |
| `npm run test:cov` | Cobertura |
| `npm run test:e2e` | E2E |
| `npm run lint` | ESLint com `--fix` |

### Deploy (Render)

[`render.yaml`](delfos-backend/render.yaml) declara o serviço Docker. O
[`Dockerfile`](delfos-backend/Dockerfile) embute binários do Tailscale e o
[`start.sh`](delfos-backend/start.sh) sobe `tailscaled` em modo userspace (proxy SOCKS5 em
`localhost:1055`) antes do Nest — caminho legado, documentado em
[`docs/TRINO-VPN-TAILSCALE.md`](delfos-backend/docs/TRINO-VPN-TAILSCALE.md).

Com o Trino exposto direto via HTTPS (setup atual), **não** defina `TS_AUTHKEY` nem
`TRINO_SOCKS_PROXY`; use `TRINO_URL=https://<IP-PUBLICO>:8443` + `TRINO_TLS_INSECURE=true`.

---

## 4. Frontend (Next.js)

```bash
cd frontend

npm install
# .env.local já existe; ajustar se o backend não estiver em localhost:3001

npm run dev                     # http://localhost:3000
```

### Variáveis

`.env.local` (dev):

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_TOKEN_STORAGE_KEY=delfos_auth_token
NEXT_PUBLIC_USER_STORAGE_KEY=delfos_user_data
```

`.env.production` aponta para o backend no Render.

### Rotas

| Rota | Descrição |
|---|---|
| `/login`, `/register` | Autenticação |
| `/dashboard` | Visão geral |
| `/queries` | Escrever pergunta e revisar o SQL gerado |
| `/results` | Resultados da execução |
| `/history` | Histórico de consultas |
| `/databases` | Diagrama de schemas (ReactFlow) |

### Build

```bash
npm run build
npm start
```

---

## 5. Trino — configuração completa

Trino federa os bancos-alvo. Deploy em VM (Oracle Cloud Free Tier ou AWS EC2), exposto na internet
via **HTTPS + autenticação por senha** com certificado self-signed. O backend alcança em
`https://<IP-PUBLICO>:8443`.

### 5.1 Catálogos

| Catálogo | Origem | Conector |
|---|---|---|
| `supabase_targets` | Supabase (projeto `delfos-targets`) | `postgresql` |
| `mongodb_telemetria` | MongoDB Atlas (`db_telemetria`) | `mongodb` |

`supabase_targets` é **um catálogo** com **um schema por banco**: `db_frota`, `db_rh`, `db_crm`,
`db_operacoes`, `db_financeiro`, `db_manutencao`, `db_estoque`.
FQN: `supabase_targets.db_frota.<tabela>`.

### 5.2 Estrutura dos arquivos

```
trino/
├── docker-compose.yml                        # 1 container, publica só a 8443
├── .env.example                              # credenciais dos catálogos (copiar p/ .env)
├── .gitignore                                # ignora .env, config/cert/, config/password.db
├── aws/                                      # scripts do deploy alternativo em EC2
│   ├── create-trino-aws.sh
│   ├── ec2-userdata.sh
│   └── README-aws.md
└── config/                                   # montado em /etc/trino
    ├── config.properties                     # HTTPS:8443 + auth PASSWORD; HTTP:8080 interno
    ├── node.properties
    ├── jvm.config
    ├── password-authenticator.properties     # authenticator file/bcrypt
    ├── password.db                           # GERADO na VM — não versionado
    ├── cert/trino.pem                        # GERADO na VM — não versionado
    └── catalog/
        ├── supabase_targets.properties
        └── mongodb_telemetria.properties
```

### 5.3 Como as credenciais chegam nos catálogos

Nenhum segredo fica nos `.properties`. A cadeia é:

```
trino/.env  ──▶  docker-compose.yml (environment:)  ──▶  ${ENV:VAR} nos .properties
```

Exemplo, [`config/catalog/supabase_targets.properties`](trino/config/catalog/supabase_targets.properties):

```properties
connector.name=postgresql
connection-url=jdbc:postgresql://${ENV:SUPABASE_TARGETS_HOST}:${ENV:SUPABASE_TARGETS_PORT}/${ENV:SUPABASE_TARGETS_DB}?sslmode=require
connection-user=${ENV:SUPABASE_TARGETS_USER}
connection-password=${ENV:SUPABASE_TARGETS_PASSWORD}
```

[`config/catalog/mongodb_telemetria.properties`](trino/config/catalog/mongodb_telemetria.properties):

```properties
connector.name=mongodb
mongodb.connection-url=${ENV:ATLAS_URI}
```

Para **adicionar um novo catálogo**: crie `config/catalog/<nome>.properties` usando `${ENV:...}`,
declare as variáveis no bloco `environment:` do `docker-compose.yml`, adicione ao `.env` e
reinicie o container. O nome do arquivo vira o nome do catálogo no SQL.

### 5.4 Arquivos de configuração — o que cada chave faz

[`config/config.properties`](trino/config/config.properties):

```properties
coordinator=true
node-scheduler.include-coordinator=true        # single-node: coordinator também executa
http-server.http.port=8080                     # HTTP interno (discovery) — NÃO publicar
discovery.uri=http://localhost:8080
http-server.authentication.type=PASSWORD       # exige TLS; clientes em HTTP puro são recusados
http-server.https.enabled=true
http-server.https.port=8443
internal-communication.shared-secret=${ENV:TRINO_SHARED_SECRET}
http-server.https.keystore.path=/etc/trino/cert/trino.pem   # PEM único (chave + cert)
query.max-memory=4GB
query.max-memory-per-node=3GB
memory.heap-headroom-per-node=1GB
```

Regra de memória: `max-memory-per-node + heap-headroom-per-node` precisa caber no `-Xmx` do
`jvm.config` (3G + 1G = 4G < 5G ✅).

[`config/jvm.config`](trino/config/jvm.config) — heap 5G para VM de 8 GiB. `-Xms` = `-Xmx`.
Não combine `-Xmx` com `*RAMPercentage` (conflitam).

[`config/node.properties`](trino/config/node.properties) — `node.environment=tcc`,
`node.id=trino-node-1`, `node.data-dir=/data/trino`.

[`config/password-authenticator.properties`](trino/config/password-authenticator.properties) —
`password-authenticator.name=file` + `file.password-file=/etc/trino/password.db`.

### 5.5 Passo a passo do deploy

```bash
cd trino
mkdir -p config/cert
```

**1) Certificado self-signed** (PEM único com chave + certificado; `CN` = IP público ou domínio):

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout /tmp/key.pem -out /tmp/crt.pem \
  -subj "/CN=<IP-PUBLICO-VM>" \
  -addext "subjectAltName=IP:<IP-PUBLICO-VM>"
cat /tmp/key.pem /tmp/crt.pem > config/cert/trino.pem
rm /tmp/key.pem /tmp/crt.pem
```

> Ordem importa: o Trino espera chave **e** certificado no mesmo PEM.

**2) Arquivo de senhas bcrypt** (o usuário precisa ser o mesmo do `TRINO_USER` do backend):

```bash
htpasswd -B -C 10 -c config/password.db delfos_user     # pede a senha interativamente
```

`-B` = bcrypt, `-C 10` = custo, `-c` = cria o arquivo (**omita o `-c`** ao adicionar um segundo
usuário, senão o arquivo é sobrescrito).

**3) Segredo interno + credenciais dos catálogos:**

```bash
cp .env.example .env
openssl rand -hex 32          # valor de TRINO_SHARED_SECRET
nano .env
```

`.env` preenchido:

```
TRINO_SHARED_SECRET=<saída do openssl rand -hex 32>

SUPABASE_TARGETS_HOST=db.<REF>.supabase.co
SUPABASE_TARGETS_PORT=5432
SUPABASE_TARGETS_DB=postgres
SUPABASE_TARGETS_USER=postgres.<REF>
SUPABASE_TARGETS_PASSWORD=<senha do Supabase>

ATLAS_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/db_telemetria
```

**4) Subir:**

```bash
docker compose up -d
docker compose logs -f trino        # aguardar "SERVER STARTED"
```

### 5.6 Abrir a porta 8443

Duas camadas — cloud e sistema operacional.

**Oracle Cloud (OCI):** Security List / NSG da VCN → ingress `8443/tcp`.

**AWS EC2:** Security Group inbound → `8443/tcp` de `0.0.0.0/0`; `22/tcp` restrito ao seu IP.

**Firewall do SO:**

```bash
# Ubuntu
sudo iptables -I INPUT 6 -p tcp --dport 8443 -j ACCEPT
sudo netfilter-persistent save

# Oracle Linux / Amazon Linux
sudo firewall-cmd --add-port=8443/tcp --permanent && sudo firewall-cmd --reload
```

> **Nunca publique a 8080.** É o canal HTTP interno de discovery e não passa pelo authenticator —
> quem alcançar essa porta consulta os bancos sem senha. Só a 8443 deve ficar exposta.

### 5.7 Validar

```bash
curl -k -u delfos_user:<senha> https://<IP-PUBLICO-VM>:8443/v1/info
```

JSON de info → coordinator no ar e autenticação funcionando. `-k` aceita o cert self-signed.

### 5.8 Apontar o backend

```
TRINO_URL=https://<IP-PUBLICO-VM>:8443
TRINO_USER=delfos_user
TRINO_PASSWORD=<senha do htpasswd>
TRINO_TLS_INSECURE=true
TRINO_SOCKS_PROXY=
```

O `TrinoClientService` envia `Authorization: Basic` em todas as requisições — statement, paginação
e cancelamento.

### 5.9 Consultas de verificação

```sql
SHOW CATALOGS;
SHOW SCHEMAS FROM supabase_targets;              -- db_frota, db_rh, ...
SHOW TABLES  FROM supabase_targets.db_frota;
SELECT * FROM supabase_targets.db_frota.veiculos LIMIT 10;

SHOW TABLES FROM mongodb_telemetria.db_telemetria;
SELECT * FROM mongodb_telemetria.db_telemetria.<coleção> LIMIT 10;
```

### 5.10 Deploy alternativo em AWS EC2

Mesma config `trino/`, só muda a VM. Instância `m7i-flex.large` (8 GiB, 2 vCPU), Amazon Linux 2023,
disco 20 GB gp3, user data = [`aws/ec2-userdata.sh`](trino/aws/ec2-userdata.sh). Passo a passo em
[`aws/README-aws.md`](trino/aws/README-aws.md).

Trino é stateless — Oracle e AWS podem coexistir; o failover é só trocar o IP no backend.

---

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Backend não conecta no Postgres | `POSTGRES_PORT=5432` no `.env` | O compose publica em **5442** |
| `Table 'users' doesn't exist` | Volume criado antes dos `init-scripts` | `cd postgresql && docker compose down -v && docker compose up -d` (apaga dados) |
| Porta 3001 em uso | Outro processo | Alterar `PORT` no `.env` |
| RAG: `401` / `Unauthorized` no Weaviate | `VECTOR_STORE_API_KEY` ≠ key do compose | Igualar os dois valores |
| RAG conecta no REST mas falha na query | Porta gRPC 50051 fechada | Publicar/liberar 50051 — o cliente v4 exige |
| Trino recusa a conexão em HTTP | `authentication.type=PASSWORD` exige TLS | Usar `https://...:8443` |
| `certificate signed by unknown authority` | Cert self-signed | `TRINO_TLS_INSECURE=true` no backend; `-k` no curl |
| Trino sobe e morre sozinho | OOM — heap 5G sem RAM/swap | Conferir `free -h`; ajustar `-Xmx` no `jvm.config` |
| Catálogo não aparece em `SHOW CATALOGS` | Variável ausente no `.env` ou não declarada no compose | Conferir a cadeia `.env` → `environment:` → `${ENV:...}` |
| RAG retorna contexto vazio | Schemas não indexados | `POST /api/schemas/sync` no backend |
| Cold start lento no RAG | Download do modelo de embedding em runtime | Usar a imagem Docker (modelo embutido no build) |

## Segurança

- `.env`, `trino/config/cert/` e `trino/config/password.db` **não são versionados** — gerados por ambiente.
- `JWT_SECRET` e `TRINO_SHARED_SECRET` devem ser aleatórios por ambiente (`openssl rand -hex 32`).
- Porta 8080 do Trino permanece interna.
- `TRINO_TLS_INSECURE=true` desativa a verificação do certificado; é aceitável apenas com cert self-signed em host conhecido.

- A API key do Weaviate vem de `weaviate/.env` (ignorado). Os composes usam `${WEAVIATE_API_KEY:?}` e abortam se ela faltar.

- O admin inicial vem de `ADMIN_EMAIL` / `ADMIN_PASSWORD` no `postgresql/.env`. Sem eles, nenhum usuário é criado.

Pendências conhecidas:

- A key que estava hardcoded no `docker-compose.ec2.yaml` continua ativa no Weaviate da EC2 até ser rotacionada — gere uma nova no `.env` de lá e atualize o `VECTOR_STORE_API_KEY` do RAG.
- Volumes de Postgres criados antes desta mudança ainda contêm `admin@delfos.local` / `admin123`. Troque a senha (comando acima) ou remova o usuário.
