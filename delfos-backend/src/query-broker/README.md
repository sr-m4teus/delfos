# QueryBroker Module

Módulo inteligente para análise de consultas em linguagem natural e busca de contexto relevante do RAG Orchestrator.

## Descrição

O QueryBroker é responsável por:

1. **Analisar consultas em linguagem natural** usando técnicas NLP para extrair componentes
2. **Identificar entidades e tabelas** mencionadas na consulta
3. **Extrair ações, filtros e agregações** da consulta
4. **Buscar contexto relevante** do RAG Orchestrator (schemas e queries relacionadas)
5. **Combinar análise e contexto** para preparar dados para tradução SQL

## Arquitetura

```
QueryBrokerController
    ↓
QueryBrokerService (orquestrador)
    ├── QueryAnalyzerService (análise NLP)
    └── RagOrchestratorClientService (busca contexto)
```

## Componentes

### QueryBrokerService

Serviço principal que orquestra todo o fluxo:
- Recebe consulta em linguagem natural
- Chama QueryAnalyzer para extrair componentes
- Chama RagOrchestratorClient para buscar contexto
- Combina resultados e retorna análise completa

### QueryAnalyzerService

Analisa consultas usando técnicas NLP:
- **Tokenização**: Divide consulta em palavras
- **Extração de entidades**: Identifica tabelas/entidades mencionadas
- **Identificação de ações**: Detecta ações (SELECT, COUNT, SUM, etc.)
- **Extração de filtros**: Identifica condições e filtros
- **Detecção de agregações**: Encontra agregações (SUM, AVG, COUNT, etc.)
- **Relacionamentos**: Identifica relacionamentos entre entidades

**Técnicas utilizadas**:
- Análise de palavras-chave e sinônimos
- Padrões regex para estruturas comuns
- Dicionário de termos de negócio
- Normalização de texto (lowercase, remoção de acentos)

### RagOrchestratorClientService

Cliente HTTP para comunicação com RAG Orchestrator:
- Faz requisições para `/api/v1/context`
- Trata erros e timeouts
- Retorna contexto vazio se RAG estiver indisponível (graceful degradation)

## Endpoint

### POST `/api/query-broker/analyze`

Analisa uma consulta em linguagem natural e busca contexto relevante.

**Request Body**:
```json
{
  "natural_language_query": "Mostre todos os clientes que compraram mais de 1000 reais este mês",
  "max_context_results": 10,
  "min_relevance_score": 0.5
}
```

**Response**:
```json
{
  "query": "Mostre todos os clientes que compraram mais de 1000 reais este mês",
  "components": {
    "entities": ["clientes", "compras"],
    "actions": ["SELECT"],
    "filters": [
      {
        "field": "valor",
        "operator": ">",
        "value": 1000,
        "originalText": "mais de 1000 reais"
      },
      {
        "field": "data",
        "operator": "=",
        "value": "current_month",
        "originalText": "este mês"
      }
    ],
    "aggregations": [],
    "relationships": [
      {
        "fromEntity": "clientes",
        "toEntity": "compras",
        "type": "has_many",
        "confidence": 0.7
      }
    ],
    "confidence": 0.85
  },
  "context": {
    "schemas": [...],
    "queries": [...],
    "metadata": {
      "total_schemas_found": 5,
      "total_queries_found": 3,
      "limit_applied": 10,
      "search_time_ms": 125.5
    }
  },
  "analysis_time_ms": 250.5
}
```

## Configuração

### Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
# RAG Orchestrator Configuration
RAG_ORCHESTRATOR_URL=http://localhost:8000
RAG_ORCHESTRATOR_TIMEOUT=30000
```

### Integração no AppModule

O módulo já está integrado no `AppModule`. Certifique-se de que o `HttpModule` está disponível globalmente (já está configurado).

## Uso

### Importar o Módulo

O módulo já está importado no `AppModule`. Para usar em outros módulos:

```typescript
import { QueryBrokerModule } from './query-broker/query-broker.module';

@Module({
  imports: [QueryBrokerModule],
})
export class YourModule {}
```

### Usar o Serviço

```typescript
import { QueryBrokerService } from './query-broker/services/query-broker.service';
import { AnalyzeQueryRequestDto } from './query-broker/dto/analyze-query-request.dto';

@Injectable()
export class YourService {
  constructor(private readonly queryBrokerService: QueryBrokerService) {}

  async processQuery(query: string) {
    const request: AnalyzeQueryRequestDto = {
      natural_language_query: query,
      max_context_results: 10,
      min_relevance_score: 0.5,
    };

    const result = await this.queryBrokerService.analyzeQuery(request);
    
    // Usar componentes e contexto
    console.log('Entidades:', result.components.entities);
    console.log('Schemas:', result.context.schemas);
    
    return result;
  }
}
```

## Exemplos de Análise

### Exemplo 1: Consulta Simples

**Consulta**: "Mostre todos os clientes"

**Componentes extraídos**:
- Entidades: ["clientes"]
- Ações: ["SELECT"]
- Filtros: []
- Agregações: []
- Relacionamentos: []
- Confiança: 0.7

### Exemplo 2: Consulta com Filtros

**Consulta**: "Conte quantos produtos custam mais de 500 reais"

**Componentes extraídos**:
- Entidades: ["produtos"]
- Ações: ["COUNT"]
- Filtros: [
  - { field: "valor", operator: ">", value: 500 }
  ]
- Agregações: ["COUNT"]
- Relacionamentos: []
- Confiança: 0.85

### Exemplo 3: Consulta com Relacionamentos

**Consulta**: "Mostre todos os clientes que compraram este mês"

**Componentes extraídos**:
- Entidades: ["clientes", "compras"]
- Ações: ["SELECT"]
- Filtros: [
  - { field: "data", operator: "=", value: "current_month" }
  ]
- Agregações: []
- Relacionamentos: [
  - { fromEntity: "clientes", toEntity: "compras", type: "has_many" }
  ]
- Confiança: 0.8

## Tratamento de Erros

O módulo trata erros de forma robusta:

- **RAG Orchestrator indisponível**: Retorna contexto vazio e continua processamento
- **Consulta inválida**: Retorna erro 400 com mensagem descritiva
- **Timeout**: Retorna contexto vazio após timeout configurado
- **Erros de rede**: Loga erro e retorna contexto vazio

## Melhorias Futuras

- [ ] Cache de análises similares
- [ ] Aprendizado de padrões de consulta
- [ ] Validação de entidades contra schemas conhecidos
- [ ] Sugestões de melhorias na consulta
- [ ] Suporte a múltiplas intenções em uma consulta
- [ ] Integração com bibliotecas NLP mais avançadas (se necessário)
- [ ] Métricas e monitoramento de performance

## Testes

Para testar o módulo:

```bash
# Testes unitários
npm test query-broker

# Testes E2E
npm run test:e2e
```

## Documentação Swagger

Após iniciar a aplicação, acesse:
- Swagger UI: `http://localhost:3001/api/docs`
- Endpoint: `POST /api/query-broker/analyze`

## Estrutura de Arquivos

```
query-broker/
├── dto/
│   ├── analyze-query-request.dto.ts
│   ├── analyze-query-response.dto.ts
│   ├── query-components.dto.ts
│   ├── rag-context-request.dto.ts
│   └── rag-context-response.dto.ts
├── services/
│   ├── query-broker.service.ts
│   ├── query-analyzer.service.ts
│   └── rag-orchestrator-client.service.ts
├── query-broker.controller.ts
├── query-broker.module.ts
└── README.md
```
