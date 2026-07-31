# Guia de Instalação - Delfos Backend

## Passos Rápidos

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` se necessário (os valores padrão funcionam para desenvolvimento local).

### 3. Iniciar Bancos de Dados

**Terminal 1 - PostgreSQL:**
```bash
cd ../postgresql
docker-compose up -d
```

**Terminal 2 - Redis:**
```bash
cd ../redis
docker-compose up -d
```

### 4. Verificar se os Bancos Estão Rodando

```bash
# Verificar PostgreSQL
docker ps | grep postgres

# Verificar Redis
docker ps | grep redis
```

### 5. Iniciar o Backend

```bash
npm run start:dev
```

A aplicação estará disponível em:
- API: `http://localhost:3001`
- Swagger: `http://localhost:3001/api/docs`

## Testando os Endpoints

### Registrar um novo usuário

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "password": "senha123",
    "passwordConfirmation": "senha123",
    "name": "Usuário Teste"
  }'
```

### Fazer login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "password": "senha123"
  }'
```

### Validar sessão (requer token)

```bash
curl -X GET http://localhost:3001/auth/validate \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Fazer logout (requer token)

```bash
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Troubleshooting

### Erro: "Cannot connect to PostgreSQL"

1. Verifique se o PostgreSQL está rodando:
   ```bash
   cd ../postgresql
   docker-compose ps
   ```

2. Se não estiver rodando, inicie:
   ```bash
   docker-compose up -d
   ```

3. Verifique as variáveis de ambiente no `.env`

### Erro: "Cannot connect to Redis"

1. Verifique se o Redis está rodando:
   ```bash
   cd ../redis
   docker-compose ps
   ```

2. Se não estiver rodando, inicie:
   ```bash
   docker-compose up -d
   ```

### Erro: "Table 'users' doesn't exist"

O TypeORM está configurado com `synchronize: true` em desenvolvimento, então as tabelas devem ser criadas automaticamente. Se não forem:

1. Verifique se o schema `delfos` existe no PostgreSQL
2. Verifique os logs do backend para erros de conexão
3. Execute os scripts de inicialização manualmente:
   ```bash
   cd ../postgresql
   docker-compose exec postgres psql -U delfos_user -d delfos -f /docker-entrypoint-initdb.d/02-create-tables.sql
   ```

### Porta já em uso

Se a porta 3001 estiver em uso, altere no arquivo `.env`:
```env
PORT=3002
```

## Próximos Passos

Após a instalação bem-sucedida:

1. Acesse a documentação Swagger em `http://localhost:3001/api/docs`
2. Teste os endpoints de autenticação
3. Integre com o frontend configurando `NEXT_PUBLIC_API_URL=http://localhost:3001/api`
