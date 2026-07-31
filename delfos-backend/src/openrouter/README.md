# OpenRouter Integration Module

Módulo de integração com OpenRouter para tradução de consultas em linguagem natural para SQL.

## Descrição

Este módulo fornece uma interface para comunicação com a API do OpenRouter, permitindo traduzir consultas em português para SQL Federado usando modelos LLM.

## Funcionalidades

- ✅ Tradução de consultas em linguagem natural para SQL
- ✅ Suporte a contexto de schemas de bancos de dados
- ✅ Suporte a exemplos de consultas similares
- ✅ Configuração flexível de modelos LLM
- ✅ Tratamento de erros robusto
- ✅ Logging de operações

## Configuração

### Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
# OpenRouter Configuration
OPENROUTER_API_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=your-openrouter-api-key-here
OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini
OPENROUTER_TEMPERATURE=0.3
OPENROUTER_MAX_TOKENS=2000
OPENROUTER_HTTP_REFERER=https://delfos.local
OPENROUTER_X_TITLE=Delfos
```

### Obter API Key

1. Acesse [OpenRouter.ai](https://openrouter.ai/)
2. Crie uma conta ou faça login
3. Vá para "Keys" no dashboard
4. Crie uma nova API key
5. Copie a chave e adicione ao `.env`

## Uso

### Importar o Módulo

```typescript
import { OpenRouterModule } from './openrouter/openrouter.module';

@Module({
  imports: [
    // ... outros módulos
    OpenRouterModule,
  ],
})
export class YourModule {}
```

### Usar o Serviço

```typescript
import { OpenRouterService } from './openrouter/openrouter.service';
import { TranslateQueryRequestDto } from './openrouter/dto/translate-query-request.dto';

@Injectable()
export class YourService {
  constructor(private readonly openRouterService: OpenRouterService) {}

  async translateQuery() {
    const request: TranslateQueryRequestDto = {
      natural_language_query: 'Mostre todos os clientes que compraram mais de 1000 reais este mês',
      schemas: [
        {
          database_id: 'db1',
          database_name: 'Vendas',
          schema: {
            tables: [
              {
                name: 'customers',
                columns: [
                  { name: 'id', type: 'uuid' },
                  { name: 'name', type: 'varchar' },
                  { name: 'total', type: 'decimal' },
                ],
              },
            ],
          },
          relevance_score: 0.85,
        },
      ],
      query_examples: [
        {
          natural_language_query: 'Mostre todos os clientes',
          sql_query: 'SELECT * FROM customers',
          relevance_score: 0.75,
        },
      ],
    };

    const result = await this.openRouterService.translateQueryToSql(request);
    console.log(result.sql_query); // SQL traduzido
  }
}
```

## Estrutura

```
openrouter/
├── dto/
│   ├── openrouter-request.dto.ts      # DTO para requisição OpenRouter
│   ├── openrouter-response.dto.ts     # DTO para resposta OpenRouter
│   ├── translate-query-request.dto.ts # DTO para tradução de query
│   └── translate-query-response.dto.ts # DTO para resposta de tradução
├── openrouter.service.ts               # Serviço principal
├── openrouter.module.ts                # Módulo NestJS
└── README.md                           # Esta documentação
```

## Métodos Disponíveis

### `translateQueryToSql(request: TranslateQueryRequestDto): Promise<TranslateQueryResponseDto>`

Traduz uma consulta em linguagem natural para SQL usando OpenRouter.

**Parâmetros:**
- `request.natural_language_query`: Consulta em português
- `request.schemas`: Schemas relevantes dos bancos de dados (opcional)
- `request.query_examples`: Exemplos de consultas similares (opcional)
- `request.model`: Modelo LLM específico (opcional, usa padrão se não especificado)

**Retorna:**
- `sql_query`: SQL traduzido
- `model`: Modelo usado
- `usage`: Informações de uso de tokens
- `request_id`: ID da requisição

## Modelos Disponíveis

Alguns modelos populares do OpenRouter:

- `openai/gpt-4o-mini` (padrão) - Rápido e econômico
- `openai/gpt-4o` - Mais preciso
- `anthropic/claude-3.5-sonnet` - Boa para SQL
- `google/gemini-pro-1.5` - Alternativa

Consulte [OpenRouter Models](https://openrouter.ai/models) para lista completa.

## Tratamento de Erros

O serviço trata automaticamente:
- Erros de autenticação (401)
- Erros de requisição (400)
- Erros de servidor (500+)
- Timeouts
- Respostas inválidas

Todos os erros são logados e convertidos em `HttpException` do NestJS.

## Exemplo Completo

```typescript
import { Injectable } from '@nestjs/common';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { TranslateQueryRequestDto } from '../openrouter/dto/translate-query-request.dto';

@Injectable()
export class QueryService {
  constructor(private readonly openRouterService: OpenRouterService) {}

  async processNaturalLanguageQuery(
    query: string,
    schemas?: any[],
    examples?: any[],
  ) {
    try {
      const request: TranslateQueryRequestDto = {
        natural_language_query: query,
        schemas,
        query_examples: examples,
      };

      const result = await this.openRouterService.translateQueryToSql(request);
      
      return {
        success: true,
        sql: result.sql_query,
        model: result.model,
        tokensUsed: result.usage.total_tokens,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
```

## Próximos Passos

Este módulo será integrado com:
- RAG Orchestrator (para obter schemas e exemplos)
- Validação de SQL (para validar queries geradas)
- Trino (para execução das queries)
