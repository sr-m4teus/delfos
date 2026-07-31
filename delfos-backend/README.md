# Delfos Backend

Backend do sistema Delfos construído com NestJS.

## Funcionalidades

- ✅ Autenticação de usuários (Login/Register)
- ✅ Validação de sessão JWT
- ✅ Logout com invalidação de sessão
- ✅ Integração com PostgreSQL para dados persistentes
- ✅ Integração com Redis para gerenciamento de sessões
- ✅ Documentação Swagger/OpenAPI

## Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- PostgreSQL rodando (via docker-compose em `../postgresql`)
- Redis rodando (via docker-compose em `../redis`)

## Instalação

1. Instalar dependências:
```bash
npm install
```

2. Configurar variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações.

3. Iniciar bancos de dados:
```bash
# Em um terminal, iniciar PostgreSQL
cd ../postgresql
docker-compose up -d

# Em outro terminal, iniciar Redis
cd ../redis
docker-compose up -d
```

4. Executar aplicação em desenvolvimento:
```bash
npm run start:dev
```

A aplicação estará disponível em `http://localhost:3001`

## Documentação da API

Após iniciar a aplicação, acesse:
- Swagger UI: `http://localhost:3001/api/docs`

## Estrutura do Projeto

```
src/
├── auth/                    # Módulo de autenticação
│   ├── auth.controller.ts   # Endpoints de autenticação
│   ├── auth.service.ts      # Lógica de autenticação
│   ├── auth.module.ts       # Módulo de autenticação
│   ├── guards/              # Guards JWT
│   └── strategies/          # Estratégias Passport
├── users/                   # Módulo de usuários
│   ├── users.service.ts     # Serviço de usuários
│   ├── users.module.ts      # Módulo de usuários
│   └── entities/            # Entidades TypeORM
├── redis/                   # Módulo Redis
│   ├── redis.service.ts     # Serviço Redis
│   └── redis.module.ts      # Módulo Redis
├── common/                  # Código compartilhado
│   └── dto/                 # DTOs (Data Transfer Objects)
├── app.module.ts           # Módulo principal
└── main.ts                 # Arquivo de inicialização
```

## Endpoints da API

### Autenticação

- `POST /auth/login` - Realizar login
- `POST /auth/register` - Registrar novo usuário
- `GET /auth/validate` - Validar sessão (requer autenticação)
- `POST /auth/logout` - Fazer logout (requer autenticação)

## Variáveis de Ambiente

Veja `.env.example` para todas as variáveis disponíveis.

Principais variáveis:
- `PORT` - Porta do servidor (padrão: 3001)
- `POSTGRES_*` - Configurações do PostgreSQL
- `REDIS_*` - Configurações do Redis
- `JWT_SECRET` - Chave secreta para JWT
- `JWT_EXPIRES_IN` - Tempo de expiração do token em segundos
- `CORS_ORIGIN` - Origem permitida para CORS

## Scripts

- `npm run start` - Iniciar aplicação
- `npm run start:dev` - Iniciar em modo desenvolvimento (watch)
- `npm run start:prod` - Iniciar em modo produção
- `npm run build` - Compilar aplicação
- `npm run test` - Executar testes
- `npm run lint` - Executar linter

## Desenvolvimento

### Estrutura de Dados

O backend utiliza o schema `delfos` no PostgreSQL com as seguintes tabelas:

- `users` - Usuários do sistema
- `query_history` - Histórico de consultas
- `database_connections` - Conexões com bancos alvo
- `audit_log` - Logs de auditoria

### Sessões

As sessões são armazenadas no Redis com o padrão:
- Chave: `delfos:sess:{userId}`
- TTL: Configurável via `SESSION_TTL` (padrão: 3600 segundos)

### JWT

Os tokens JWT contêm:
- `sub` - ID do usuário
- `email` - Email do usuário
- `userType` - Tipo de usuário (common/admin/db-manager)
- `exp` - Data de expiração
- `iat` - Data de emissão

## Troubleshooting

### Erro de conexão com PostgreSQL

Verifique se o PostgreSQL está rodando:
```bash
cd ../postgresql
docker-compose ps
```

### Erro de conexão com Redis

Verifique se o Redis está rodando:
```bash
cd ../redis
docker-compose ps
```

### Erro de validação

Certifique-se de que todas as variáveis de ambiente estão configuradas corretamente no arquivo `.env`.
