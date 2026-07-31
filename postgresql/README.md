# PostgreSQL - Delfos Database

Banco de dados relacional PostgreSQL para armazenar dados internos do sistema Delfos.

## Descrição

Este componente fornece uma instância PostgreSQL configurada via Docker Compose para armazenar dados internos do sistema Delfos, incluindo usuários, histórico de consultas, conexões de banco de dados e logs de auditoria.

## Estrutura

```
postgresql/
├── docker-compose.yml          # Configuração Docker Compose
├── postgresql.conf             # Configuração do PostgreSQL
├── init-scripts/                # Scripts de inicialização
│   ├── 01-init-database.sql    # Inicialização do banco
│   ├── 02-create-tables.sql     # Criação das tabelas
│   └── 03-create-admin-user.sql # Usuário admin padrão
├── migrations/                 # Migrations do banco (opcional)
│   └── .gitkeep
├── .env                        # Variáveis de ambiente (não versionado)
├── .env.example                # Exemplo de variáveis de ambiente
├── .gitignore                  # Arquivos ignorados pelo Git
└── README.md                   # Esta documentação
```

## Pré-requisitos

- Docker instalado
- Docker Compose instalado (versão 3.8+)
- Porta 5432 disponível (padrão do PostgreSQL)

## Uso Rápido

### Iniciar o PostgreSQL

```bash
cd postgresql
docker-compose up -d
```

### Verificar status

```bash
docker-compose ps
```

### Ver logs

```bash
docker-compose logs -f postgres
```

### Parar o PostgreSQL

```bash
docker-compose down
```

### Parar e remover volumes (dados)

```bash
docker-compose down -v
```

⚠️ **ATENÇÃO**: Isso remove todos os dados do banco!

## Configuração

### Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e ajuste conforme necessário:

```bash
cp .env.example .env
```

Principais variáveis:

- `POSTGRES_DB`: Nome do banco de dados (padrão: delfos)
- `POSTGRES_USER`: Usuário do banco (padrão: delfos_user)
- `POSTGRES_PASSWORD`: Senha do banco (padrão: delfos_password)
- `POSTGRES_HOST`: Host do PostgreSQL (padrão: localhost)
- `POSTGRES_PORT`: Porta do PostgreSQL (padrão: 5432)

### Configuração do PostgreSQL

O arquivo `postgresql.conf` contém as configurações do PostgreSQL. Principais configurações:

- **Memória compartilhada**: 128MB
- **Cache efetivo**: 512MB
- **Conexões máximas**: 100
- **Timezone**: UTC
- **Logging**: Habilitado com rotação diária
- **Autovacuum**: Habilitado

### Segurança

⚠️ **IMPORTANTE**: Para ambientes de produção:

1. Altere as senhas padrão no arquivo `.env`:
   ```env
   POSTGRES_PASSWORD=sua-senha-forte-aqui
   ```

2. Configure `pg_hba.conf` para restringir conexões

3. Use SSL/TLS para conexões remotas

4. Remova ou altere o usuário admin padrão criado em `init-scripts/03-create-admin-user.sql`

## Schema do Banco de Dados

### Tabelas Principais

#### `delfos.users`
Armazena informações dos usuários do sistema.

**Campos**:
- `id`: UUID (chave primária)
- `email`: VARCHAR(255) (único, usado para login)
- `name`: VARCHAR(255)
- `password_hash`: VARCHAR(255)
- `role`: VARCHAR(50) ('common', 'admin', 'db-manager')
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP
- `last_login`: TIMESTAMP
- `is_active`: BOOLEAN

#### `delfos.query_history`
Armazena histórico de consultas executadas pelos usuários.

**Campos**:
- `id`: UUID (chave primária)
- `user_id`: UUID (FK para users)
- `natural_language_query`: TEXT
- `sql_query`: TEXT
- `executed_sql`: TEXT
- `was_edited`: BOOLEAN
- `was_successful`: BOOLEAN
- `execution_time_ms`: INTEGER
- `result_count`: INTEGER
- `created_at`: TIMESTAMP
- `marked_as_successful`: BOOLEAN (para aprendizado do RAG)

#### `delfos.database_connections`
Armazena informações sobre conexões com bancos de dados alvo.

**Campos**:
- `id`: UUID (chave primária)
- `name`: VARCHAR(255) (único)
- `description`: TEXT
- `connection_type`: VARCHAR(50)
- `connection_string`: TEXT (criptografado)
- `is_active`: BOOLEAN
- `created_by`: UUID (FK para users)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

#### `delfos.audit_log`
Armazena logs de auditoria para segurança e compliance.

**Campos**:
- `id`: UUID (chave primária)
- `user_id`: UUID (FK para users)
- `action`: VARCHAR(100)
- `resource_type`: VARCHAR(100)
- `resource_id`: UUID
- `details`: JSONB
- `ip_address`: INET
- `user_agent`: TEXT
- `created_at`: TIMESTAMP

### Extensões Instaladas

- `uuid-ossp`: Para geração de UUIDs
- `pgcrypto`: Para funções de criptografia

### Índices

O schema inclui índices otimizados para:
- Busca por email de usuário
- Busca por role de usuário
- Histórico de consultas por usuário
- Full-text search em consultas em linguagem natural
- Logs de auditoria por data e ação

## Integração com Backend

### Node.js (pg/Sequelize/TypeORM)

#### Usando `pg` (driver nativo)

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'delfos',
  user: process.env.POSTGRES_USER || 'delfos_user',
  password: process.env.POSTGRES_PASSWORD || 'delfos_password',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
});

// Exemplo de query
const result = await pool.query('SELECT * FROM delfos.users WHERE email = $1', [email]);
```

#### Usando Sequelize

```javascript
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.POSTGRES_DB || 'delfos',
  process.env.POSTGRES_USER || 'delfos_user',
  process.env.POSTGRES_PASSWORD || 'delfos_password',
  {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    dialect: 'postgres',
    schema: 'delfos',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);
```

#### Instalação de dependências

```bash
# Para pg (driver nativo)
npm install pg

# Para Sequelize
npm install sequelize pg pg-hstore

# Para TypeORM
npm install typeorm pg reflect-metadata
```

## Monitoramento

### Conectar ao banco via CLI

```bash
docker-compose exec postgres psql -U delfos_user -d delfos
```

### Comandos úteis do PostgreSQL

```sql
-- Listar todas as tabelas
\dt delfos.*

-- Descrever estrutura de uma tabela
\d delfos.users

-- Ver tamanho do banco
SELECT pg_size_pretty(pg_database_size('delfos'));

-- Ver conexões ativas
SELECT * FROM pg_stat_activity;

-- Ver estatísticas de tabelas
SELECT * FROM pg_stat_user_tables WHERE schemaname = 'delfos';

-- Ver índices
SELECT * FROM pg_indexes WHERE schemaname = 'delfos';
```

### Verificar uso de recursos

```bash
# Ver uso de memória e CPU
docker stats delfos-postgres

# Ver logs do PostgreSQL
docker-compose logs -f postgres
```

## Backup e Restore

### Backup

```bash
# Backup completo do banco
docker-compose exec postgres pg_dump -U delfos_user -d delfos > backup-$(date +%Y%m%d).sql

# Backup apenas do schema
docker-compose exec postgres pg_dump -U delfos_user -d delfos --schema-only > schema-backup.sql

# Backup apenas dos dados
docker-compose exec postgres pg_dump -U delfos_user -d delfos --data-only > data-backup.sql

# Backup customizado (com compressão)
docker-compose exec postgres pg_dump -U delfos_user -d delfos -Fc > backup-$(date +%Y%m%d).dump
```

### Restore

```bash
# Restore de arquivo SQL
docker-compose exec -T postgres psql -U delfos_user -d delfos < backup-20250114.sql

# Restore de arquivo customizado
docker-compose exec postgres pg_restore -U delfos_user -d delfos backup-20250114.dump
```

## Migrations

### Criar uma nova migration

```bash
# Criar arquivo de migration
touch migrations/$(date +%Y%m%d%H%M%S)_nome_da_migration.sql
```

### Executar migrations manualmente

```bash
# Executar migration específica
docker-compose exec -T postgres psql -U delfos_user -d delfos < migrations/20250114120000_nome_da_migration.sql

# Executar todas as migrations
for file in migrations/*.sql; do
  docker-compose exec -T postgres psql -U delfos_user -d delfos < "$file"
done
```

## Troubleshooting

### PostgreSQL não inicia

1. Verifique se a porta 5432 está disponível:
   ```bash
   netstat -an | grep 5432
   ```

2. Verifique os logs:
   ```bash
   docker-compose logs postgres
   ```

3. Verifique permissões dos volumes:
   ```bash
   docker volume inspect delfos-postgres-data
   ```

### Conexão recusada

1. Verifique se o PostgreSQL está rodando:
   ```bash
   docker-compose ps
   ```

2. Verifique se o host e porta estão corretos no `.env`

3. Teste a conexão manualmente:
   ```bash
   docker-compose exec postgres psql -U delfos_user -d delfos -c "SELECT version();"
   ```

### Erro de autenticação

1. Verifique as credenciais no arquivo `.env`

2. Verifique o arquivo `pg_hba.conf` (dentro do container):
   ```bash
   docker-compose exec postgres cat /var/lib/postgresql/data/pgdata/pg_hba.conf
   ```

### Banco de dados não encontrado

1. Verifique se o banco foi criado:
   ```bash
   docker-compose exec postgres psql -U delfos_user -l
   ```

2. Execute os scripts de inicialização manualmente se necessário

### Performance lenta

1. Verifique estatísticas do banco:
   ```sql
   SELECT * FROM pg_stat_user_tables WHERE schemaname = 'delfos';
   ```

2. Execute `VACUUM ANALYZE`:
   ```sql
   VACUUM ANALYZE;
   ```

3. Verifique índices não utilizados:
   ```sql
   SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'delfos';
   ```

## Desenvolvimento

### Resetar banco de dados (CUIDADO!)

```bash
# Parar e remover volumes
docker-compose down -v

# Reiniciar (recria tudo do zero)
docker-compose up -d
```

### Executar queries de teste

```bash
# Conectar ao banco
docker-compose exec postgres psql -U delfos_user -d delfos

# Exemplos de queries
SELECT * FROM delfos.users;
SELECT COUNT(*) FROM delfos.query_history;
SELECT * FROM delfos.audit_log ORDER BY created_at DESC LIMIT 10;
```

## Produção

Para ambientes de produção, considere:

1. **Senha forte**: Altere todas as senhas padrão
2. **SSL/TLS**: Configure conexões seguras
3. **Replicação**: Configure replicas para alta disponibilidade
4. **Backup automático**: Configure backups regulares
5. **Monitoramento**: Configure alertas e monitoramento
6. **Limites de recursos**: Ajuste `max_connections` e memória conforme necessário
7. **Network isolation**: Use redes Docker isoladas
8. **Firewall**: Restrinja acesso à porta 5432
9. **Audit logging**: Configure logs detalhados de segurança
10. **Migrations**: Use ferramenta de migrations (ex: Flyway, Liquibase, Sequelize migrations)

## Referências

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [pg (Node.js driver)](https://node-postgres.com/)
- [Sequelize](https://sequelize.org/)
- [TypeORM](https://typeorm.io/)
