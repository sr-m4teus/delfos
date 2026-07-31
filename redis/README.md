# Redis - Delfos Session Storage

Serviço Redis para armazenamento de sessões do sistema Delfos.

## Descrição

Este componente fornece uma instância Redis configurada via Docker Compose para armazenar sessões de usuário do sistema Delfos. O Redis é usado como store de sessões para garantir escalabilidade e performance.

## Estrutura

```
redis/
├── docker-compose.yml    # Configuração Docker Compose
├── redis.conf            # Configuração do Redis
├── .env                  # Variáveis de ambiente (não versionado)
├── .env.example          # Exemplo de variáveis de ambiente
├── .gitignore            # Arquivos ignorados pelo Git
└── README.md             # Esta documentação
```

## Pré-requisitos

- Docker instalado
- Docker Compose instalado (versão 3.8+)
- Porta 6379 disponível (padrão do Redis)

## Uso Rápido

### Iniciar o Redis

```bash
cd redis
docker-compose up -d
```

### Verificar status

```bash
docker-compose ps
```

### Ver logs

```bash
docker-compose logs -f redis
```

### Parar o Redis

```bash
docker-compose down
```

### Parar e remover volumes (dados)

```bash
docker-compose down -v
```

## Configuração

### Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e ajuste conforme necessário:

```bash
cp .env.example .env
```

Principais variáveis:

- `REDIS_HOST`: Host do Redis (padrão: localhost)
- `REDIS_PORT`: Porta do Redis (padrão: 6379)
- `REDIS_PASSWORD`: Senha do Redis (deixe vazio para desenvolvimento)
- `REDIS_DB`: Número do banco de dados (0-15, padrão: 0)
- `SESSION_TTL`: Tempo de vida da sessão em segundos (padrão: 3600 = 1 hora)
- `SESSION_PREFIX`: Prefixo para chaves de sessão (padrão: delfos:sess:)

### Configuração do Redis

O arquivo `redis.conf` contém as configurações do Redis. Principais configurações:

- **Memória máxima**: 256MB (ajuste conforme necessário)
- **Política de eviction**: `allkeys-lru` (remove chaves menos usadas quando a memória está cheia)
- **Persistência**: AOF (Append Only File) habilitado para garantir durabilidade
- **Logs**: Nível `notice` (ajuste conforme necessário)

### Segurança

⚠️ **IMPORTANTE**: Para ambientes de produção:

1. Configure uma senha forte no arquivo `redis.conf`:
   ```
   requirepass sua-senha-forte-aqui
   ```

2. Atualize o arquivo `.env` com a senha:
   ```
   REDIS_PASSWORD=sua-senha-forte-aqui
   ```

3. Configure `protected-mode yes` no `redis.conf` se não usar senha

## Integração com Backend

### Node.js (Express)

Exemplo de configuração com `express-session` e `connect-redis`:

```javascript
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const redis = require('redis');

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_TTL || '3600') * 1000,
  },
}));
```

### Instalação de dependências

```bash
npm install express-session connect-redis redis
```

## Monitoramento

### Verificar conexões ativas

```bash
docker-compose exec redis redis-cli INFO clients
```

### Verificar uso de memória

```bash
docker-compose exec redis redis-cli INFO memory
```

### Listar todas as chaves de sessão

```bash
docker-compose exec redis redis-cli KEYS "delfos:sess:*"
```

### Limpar todas as sessões

```bash
docker-compose exec redis redis-cli FLUSHDB
```

⚠️ **CUIDADO**: `FLUSHDB` remove todos os dados do banco atual!

## Health Check

O Docker Compose está configurado com health check automático. Para verificar:

```bash
docker-compose ps
```

O status `healthy` indica que o Redis está funcionando corretamente.

## Troubleshooting

### Redis não inicia

1. Verifique se a porta 6379 está disponível:
   ```bash
   netstat -an | grep 6379
   ```

2. Verifique os logs:
   ```bash
   docker-compose logs redis
   ```

3. Verifique permissões do arquivo `redis.conf`

### Conexão recusada

1. Verifique se o Redis está rodando:
   ```bash
   docker-compose ps
   ```

2. Verifique se o host e porta estão corretos no `.env`

3. Teste a conexão manualmente:
   ```bash
   docker-compose exec redis redis-cli ping
   ```
   Deve retornar `PONG`

### Sessões não persistem

1. Verifique se o volume `redis-data` está sendo criado:
   ```bash
   docker volume ls | grep redis
   ```

2. Verifique as configurações de persistência no `redis.conf`

3. Verifique os logs do Redis para erros de escrita

## Backup e Restore

### Backup

```bash
# Criar backup manual
docker-compose exec redis redis-cli SAVE

# Copiar arquivo de backup
docker cp delfos-redis:/data/dump.rdb ./backup-$(date +%Y%m%d).rdb
```

### Restore

```bash
# Copiar arquivo de backup para o container
docker cp ./backup-20250114.rdb delfos-redis:/data/dump.rdb

# Reiniciar o container para carregar o backup
docker-compose restart redis
```

## Desenvolvimento

### Acessar CLI do Redis

```bash
docker-compose exec redis redis-cli
```

### Comandos úteis

```bash
# Ver todas as chaves
KEYS *

# Ver valor de uma chave
GET delfos:sess:session-id

# Definir TTL de uma chave
EXPIRE delfos:sess:session-id 3600

# Ver informações do servidor
INFO

# Ver estatísticas
INFO stats
```

## Produção

Para ambientes de produção, considere:

1. **Senha forte**: Configure `requirepass` no `redis.conf`
2. **TLS/SSL**: Configure conexões seguras
3. **Replicação**: Configure replicas para alta disponibilidade
4. **Monitoramento**: Configure alertas e monitoramento
5. **Backup automático**: Configure backups regulares
6. **Limites de recursos**: Ajuste `maxmemory` conforme necessário
7. **Network isolation**: Use redes Docker isoladas

## Referências

- [Redis Documentation](https://redis.io/documentation)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [express-session](https://github.com/expressjs/session)
- [connect-redis](https://github.com/tj/connect-redis)
