# Trino – federação dos bancos-alvo na cloud

Serviço [Trino](https://trino.io/) em Docker que consulta em SQL os bancos-alvo do Delfos
hospedados na cloud: **Supabase** (Postgres, schema por banco) e **MongoDB Atlas**.

Deploy: VM **Oracle Cloud Free Tier**, exposto direto na internet via **HTTPS + autenticação
por senha** (cert self-signed). O backend (Render) alcança em `https://<IP-PUBLICO-VM>:8443`.

## Catálogos

| Catálogo            | Origem                          | Tipo       |
|---------------------|---------------------------------|------------|
| `supabase_targets`  | Supabase (projeto delfos-targets) | PostgreSQL |
| `mongodb_telemetria`| MongoDB Atlas (db_telemetria)   | MongoDB    |

`supabase_targets` é **1 catalog** com **schema por banco** (`db_frota`, `db_rh`, `db_crm`,
`db_operacoes`, `db_financeiro`, `db_manutencao`, `db_estoque`). FQN: `supabase_targets.db_frota.<tabela>`.

Credenciais via `.env` (não versionado) → injetadas como env nos `config/catalog/*.properties`
com `${ENV:...}`. Postgres usa `sslmode=require`; Mongo usa a URI `mongodb+srv://` do Atlas.

## Deploy na VM Oracle Free Tier

```bash
cd trino
mkdir -p config/cert

# 1) cert PEM self-signed (CN = IP público ou domínio da VM)
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout config/cert/key.pem -out config/cert/crt.pem \
  -subj "/CN=<IP-PUBLICO-VM>"
cat config/cert/crt.pem config/cert/key.pem > config/cert/trino.pem

# 2) password file bcrypt (user = TRINO_USER do backend, ex delfos_user)
htpasswd -B -C 10 -c config/password.db delfos_user   # pede a senha

# 3) credenciais dos catalogs
cp .env.example .env        # preencher SUPABASE_TARGETS_* + ATLAS_URI

# 4) subir
docker compose up -d
```

### Abrir a porta 8443 (duas camadas no OCI)

1. **Security List / NSG** da VCN: ingress `8443/tcp` (origem `0.0.0.0/0` ou faixa restrita).
2. **Firewall do SO** (a imagem da VM já vem com tudo fechado):
   ```bash
   # Ubuntu
   sudo iptables -I INPUT 6 -p tcp --dport 8443 -j ACCEPT
   sudo netfilter-persistent save
   # Oracle Linux
   sudo firewall-cmd --add-port=8443/tcp --permanent && sudo firewall-cmd --reload
   ```

> A porta HTTP `8080` é **interna** (discovery/coordinator). **Não publique** a 8080 —
> só a 8443 (HTTPS autenticado) deve ficar exposta.

## Configuração do backend (Render)

```
TRINO_URL=https://<IP-PUBLICO-VM>:8443
TRINO_USER=delfos_user
TRINO_PASSWORD=<senha definida no htpasswd>
TRINO_TLS_INSECURE=true       # aceita o cert self-signed
TRINO_SOCKS_PROXY=            # vazio (sem VPN/Tailscale)
```

O `TrinoClientService` envia `Authorization: Basic` em todas as requisições (statement,
paginação e cancelamento) e, com `TRINO_TLS_INSECURE=true`, aceita o certificado self-signed.

## Smoke test

```bash
curl -k -u delfos_user:<senha> https://<IP-PUBLICO-VM>:8443/v1/info
```

Retorna o JSON de info do Trino → coordinator no ar e auth ok.

## Exemplos de uso (SQL)

```sql
SHOW CATALOGS;
SHOW SCHEMAS FROM supabase_targets;            -- db_frota, db_rh, ...
SHOW TABLES  FROM supabase_targets.db_frota;
SELECT * FROM supabase_targets.db_frota.veiculos LIMIT 10;

-- MongoDB Atlas
SHOW TABLES FROM mongodb_telemetria.db_telemetria;
SELECT * FROM mongodb_telemetria.db_telemetria.<coleção> LIMIT 10;
```

## Estrutura

```
trino/
├── docker-compose.yml          # 1 container, expõe 8443 (HTTPS)
├── .env.example                # creds dos catalogs (copiar p/ .env)
├── .gitignore                  # ignora .env, config/cert/, config/password.db
└── config/                     # montado em /etc/trino
    ├── config.properties       # HTTPS:8443 + auth PASSWORD; HTTP:8080 interno
    ├── node.properties
    ├── jvm.config
    ├── password-authenticator.properties   # file/bcrypt
    ├── password.db             # gerado na VM (NÃO versionado)
    ├── cert/trino.pem          # gerado na VM (NÃO versionado)
    └── catalog/
        ├── supabase_targets.properties
        └── mongodb_telemetria.properties
```
