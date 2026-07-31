# RAG Orchestrator para o Projeto Delfos: Uma Análise Técnica Aprofundada

## Introdução

O **RAG Orchestrator** é um microsserviço Python desenvolvido para o projeto **Delfos** — um sistema de tradução de consultas em linguagem natural para SQL Federado. O papel deste componente é exclusivamente fornecer **contexto** aos agentes de tradução: ele não gera SQL, não executa queries e não autentica usuários. Sua responsabilidade é clara e bem delimitada — armazenar schemas de bancos de dados e consultas validadas, recuperá-los com inteligência semântica e entregá-los formatados quando solicitado.

A arquitetura do projeto materializa com elegância o padrão **RAG (Retrieval-Augmented Generation)**: ao invés de depender apenas do conhecimento estático de um modelo de linguagem, o sistema injeta no contexto do agente informações precisas e atualizadas sobre a estrutura dos bancos de dados-alvo e sobre pares NL→SQL que já foram validados por usuários reais — promovendo um ciclo de aprendizado contínuo.

---

## Estrutura do Projeto

O repositório está organizado de forma limpa, separando claramente as responsabilidades entre camadas:

```
rag_orchestrator/
├── src/
│   ├── main.py                          # Ponto de entrada FastAPI
│   ├── config/
│   │   └── settings.py                  # Configurações via variáveis de ambiente
│   ├── api/
│   │   ├── dependencies.py              # Injeção de dependências (DI)
│   │   ├── models/                      # Modelos Pydantic da API
│   │   │   ├── context_request.py
│   │   │   ├── context_response.py
│   │   │   ├── database_schema.py
│   │   │   ├── validated_query.py
│   │   │   └── error_response.py
│   │   └── routes/                      # Endpoints HTTP
│   │       ├── context.py               # POST /api/v1/context
│   │       ├── schemas.py               # POST/PUT /api/v1/schemas
│   │       └── queries.py               # POST /api/v1/queries/validate
│   └── services/
│       ├── embedding_service.py         # Interface + impl. Sentence Transformers
│       ├── vector_store_client.py       # Interface abstrata do banco vetorial
│       ├── vector_store_client_embedding_wrapper.py  # Decorator de embeddings
│       ├── weaviate_vector_store_client.py           # Impl. Weaviate
│       ├── weaviate_similarity.py       # Conversão distância → score
│       ├── mock_vector_store_client.py  # Mock para testes
│       ├── context_service.py           # Lógica de recuperação de contexto
│       ├── query_service.py             # Lógica de consultas validadas
│       └── schema_service.py            # Lógica de schemas
├── specs/
│   └── 001-rag-orchestrator/            # Especificações formais do projeto
│       ├── spec.md
│       ├── data-model.md
│       ├── plan.md
│       └── tasks.md
├── requirements.txt
└── pytest.ini
```

A separação em três camadas — **API** (rotas e modelos), **Services** (lógica de negócio) e **Infrastructure** (clientes externos) — segue o princípio da inversão de dependência: os serviços dependem de interfaces abstratas, não de implementações concretas.

---

## Arquitetura Geral

### Stack Tecnológico

| Componente | Tecnologia |
|---|---|
| Framework web | FastAPI + Uvicorn |
| Validação de dados | Pydantic v2 |
| Banco vetorial | Weaviate v4 |
| Modelo de embeddings | Sentence Transformers (local) |
| Configuração | pydantic-settings + `.env` |
| Testes | pytest + pytest-asyncio + pytest-mock |

### Fluxo de Dados Macro

O sistema expõe três grupos de endpoints REST sob o prefixo `/api/v1`:

1. **`POST /context`** — Recebe uma consulta em linguagem natural e retorna schemas + queries relevantes.
2. **`POST /schemas` e `PUT /schemas/{id}`** — Registra ou atualiza schemas de bancos de dados-alvo.
3. **`POST /queries/validate`** — Armazena uma query validada pelo usuário para aprendizado contínuo.
4. **`GET /queries/history`** — Lista o histórico de queries validadas por um usuário específico.

### Padrão de Injeção de Dependências

Em `src/api/dependencies.py`, o sistema implementa um **singleton com lru_cache** para as configurações, e um padrão de fábrica global para o cliente do banco vetorial. A lógica é inteligente: se a variável `VECTOR_STORE_URL` estiver vazia ou com o valor `"mock"`, o sistema instancia `MockVectorStoreClient` — ideal para testes e desenvolvimento local. Em produção, instancia `WeaviateVectorStoreClient` e o envolve com `VectorStoreClientEmbeddingWrapper`.

```python
def get_vector_store_client() -> VectorStoreClient:
    if url and url != "mock":
        raw_client = WeaviateVectorStoreClient(settings)
        embedding_svc = get_embedding_service()
        _vector_store_client = VectorStoreClientEmbeddingWrapper(embedding_svc, raw_client)
    else:
        _vector_store_client = MockVectorStoreClient()
```

Essa decisão de design garante que **nenhum código de teste carrega o modelo de embedding**, mantendo os testes rápidos e sem dependências de GPU/CPU intensivas.

---

## O Modelo de Armazenamento com Embeddings

### A Abstração `VectorStoreDocument`

Todo dado armazenado no banco vetorial é representado pela classe `VectorStoreDocument`:

```python
class VectorStoreDocument(BaseModel):
    id: str
    content: str         # Texto que será vetorizado
    metadata: Dict[str, Any]  # Dados estruturados (não vetorizados)
    embedding: Optional[List[float]] = None
```

O campo `content` é o texto semântico — aquilo que será convertido em vetor. O campo `metadata` armazena dados estruturados como IDs, nomes, timestamps e SQL — informações que são recuperadas junto com o documento mas não participam do cálculo de similaridade.

### Duas Coleções Distintas

O sistema mantém dois espaços vetoriais separados no Weaviate, configuráveis via variáveis de ambiente:

**`database_schemas`** (padrão) — Armazena o JSON completo do schema de cada banco de dados. O campo `content` recebe o schema serializado como string JSON, e o `metadata` guarda `database_id`, `database_name` e `version`. Note um detalhe arquitetural importante: schemas **não são recuperados por similaridade semântica** — o sistema lista todos eles (`list_documents`) e os entrega integralmente ao agente. Isso faz sentido: o agente de tradução precisa conhecer todos os bancos disponíveis para gerar SQL Federado correto.

**`validated_queries`** (padrão) — Armazena pares NL→SQL validados por usuários. Aqui o campo `content` é **exclusivamente a consulta em linguagem natural** (`natural_language_query`), e o SQL correspondente fica no `metadata`. Essa separação é deliberada e semanticamente correta: o embedding representa a intenção da consulta NL, e a similaridade entre embeddings mede a proximidade semântica entre duas intenções — não entre um texto e um SQL.

```python
def _query_to_document(self, query_input, query_id) -> VectorStoreDocument:
    nl_stripped = query_input.natural_language_query.strip()
    content = nl_stripped  # Apenas NL no content; SQL fica no metadata
    metadata = {
        "query_id": query_id,
        "natural_language_query": nl_stripped,
        "sql_query": query_input.sql_query,  # SQL armazenado como metadado
        "validated_at": datetime.utcnow().isoformat(),
    }
```

### Geração de IDs Estáveis

Para schemas, o `database_id` fornecido pelo administrador é usado diretamente como chave. Para queries, o sistema gera um **ID determinístico** a partir da consulta NL usando SHA-256:

```python
def _generate_query_id(self, natural_language_query: str) -> str:
    normalized_nl = natural_language_query.strip()
    query_hash = hashlib.sha256(normalized_nl.encode("utf-8")).hexdigest()[:16]
    return f"query_{query_hash}"
```

Isso garante que a mesma pergunta (após strip) sempre gere o mesmo ID — o que possibilita **upsert idempotente**: ao validar uma query já existente, o sistema atualiza o documento ao invés de criar uma duplicata.

### Mapeamento para UUID Weaviate

O Weaviate exige UUIDs como identificadores internos. O sistema converte seus IDs de string para UUIDs usando a função `uuid5` com um namespace fixo, gerando **UUIDs determinísticos e reproduzíveis**:

```python
_NAMESPACE_UUID = uuid_lib.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

def _doc_id_to_weaviate_uuid(document_id: str) -> uuid_lib.UUID:
    return uuid_lib.uuid5(_NAMESPACE_UUID, document_id)
```

Com isso, dado um `document_id` de string, sempre é possível calcular o UUID correspondente sem consultar o banco — o que permite operações de `get_document` e `update_document` eficientes.

---

## O Serviço de Embeddings

### Design com Lazy Loading

O `SentenceTransformerEmbeddingService` utiliza o padrão **Lazy Load**: o modelo de linguagem só é carregado na primeira chamada ao método `embed()`, não na inicialização do serviço. Isso evita que a aplicação demore para iniciar e, crucialmente, evita que os testes unitários carreguem o modelo desnecessariamente.

```python
def _get_model(self):
    if self._model is None:
        from sentence_transformers import SentenceTransformer
        self._model = SentenceTransformer(self._model_name, device=self._device)
    return self._model
```

### Modelo Padrão Multilíngue

O modelo padrão configurado é `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` — um modelo eficiente que suporta mais de 50 línguas, incluindo o português. Isso é alinhado com a premissa do projeto Delfos de operar com consultas em português.

O modelo pode rodar em `cpu` (padrão) ou `cuda` (GPU), configurável via `EMBEDDING_DEVICE`. O encode é executado de forma **assíncrona** usando `loop.run_in_executor`, evitando que a operação bloqueante do PyTorch congele o event loop do FastAPI:

```python
async def embed(self, text: str) -> List[float]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, self._encode_sync, text)
```

### Princípio de Consistência de Modelo

Um invariante crítico do sistema é que o **mesmo modelo** é obrigatoriamente usado tanto para indexação (insert) quanto para busca (search). Isso é garantido estruturalmente pelo `VectorStoreClientEmbeddingWrapper`, que intercepta todas as operações de escrita e leitura e aplica o mesmo `EmbeddingService` nos dois sentidos. Se modelos diferentes fossem usados, os vetores estariam em espaços dimensionais incompatíveis e a similaridade calculada seria sem sentido.

---

## O Padrão Decorator: `VectorStoreClientEmbeddingWrapper`

Este é um dos designs mais elegantes do projeto. O `VectorStoreClientEmbeddingWrapper` implementa a interface `VectorStoreClient` e encapsula outro `VectorStoreClient`, adicionando a responsabilidade de geração automática de embeddings:

```python
class VectorStoreClientEmbeddingWrapper(VectorStoreClient):
    def __init__(self, embedding_service: EmbeddingService, client: VectorStoreClient):
        self._embedding_service = embedding_service
        self._client = client

    async def insert_document(self, collection, document) -> Dict[str, Any]:
        if document.embedding is None:
            document.embedding = await self._embedding_service.embed(document.content)
        return await self._client.insert_document(collection, document)

    async def search(self, request) -> VectorStoreSearchResponse:
        if request.query_embedding is None:
            request.query_embedding = await self._embedding_service.embed(request.query)
        return await self._client.search(request)
```

O decorator intercepta `insert_document`, `update_document` e `search`, verificando se o embedding já está presente. Se não estiver, gera automaticamente a partir do `content` (para documentos) ou do `query` (para buscas). Esse design mantém o cliente Weaviate puro — ele não sabe nada sobre embeddings — e centraliza toda a lógica de vetorização em um único lugar.

---

## O Cálculo de Similaridade

### Configuração Weaviate: Vectorizer `none`

O Weaviate é configurado com `Configure.Vectors.self_provided()` — o que corresponde ao modo `vectorizer: none`. Isso significa que **a aplicação é totalmente responsável por gerar e fornecer os vetores**, ao invés de delegar ao Weaviate (que tem seus próprios módulos de vectorização como `text2vec-openai`). Essa escolha garante controle total sobre o modelo e permite rodar o sistema completamente offline.

Ao criar uma coleção, o sistema define apenas dois campos de propriedade:

```python
await client.collections.create(
    name=collection,
    vector_config=Configure.Vectors.self_provided(),
    properties=[
        Property(name="content", data_type=DataType.TEXT),
        Property(name="metadata", data_type=DataType.TEXT),
    ],
)
```

Note que `metadata` é armazenado como TEXT (JSON serializado), não como um campo estruturado do Weaviate — isso simplifica o schema do banco vetorial e centraliza toda a lógica de parsing na aplicação.

### Busca por `near_vector`

A recuperação de documentos similares usa a operação `near_vector` do Weaviate, que realiza **busca por vizinho mais próximo (ANN)** no espaço vetorial:

```python
response = await coll.query.near_vector(
    near_vector=request.query_embedding,  # Vetor da query NL
    limit=request.top_k,
    return_metadata=MetadataQuery(distance=True),  # Retorna a distância
)
```

O Weaviate implementa internamente algoritmos como **HNSW (Hierarchical Navigable Small World)** para busca ANN eficiente, o que garante performance mesmo com grandes volumes de documentos.

### Conversão Distância → Score de Similaridade

O Weaviate retorna uma **distância** (não similaridade). A distância cosseno varia entre 0 e 2, onde 0 significa vetores idênticos e 2 significa vetores opostos. O módulo `weaviate_similarity.py` converte essa distância em um score de similaridade no intervalo [0, 1]:

```python
def similarity_score_from_weaviate_distance(distance: Optional[float]) -> float:
    if distance is None:
        return 0.0      # Ausência de medida → score mínimo (nunca assume match perfeito)
    d = float(distance)
    return max(0.0, min(1.0, 1.0 - d))
```

A fórmula `score = max(0, min(1, 1 - d))` é uma conversão linear simples e conservadora:

- `distance = 0.0` → `score = 1.0` (vetores idênticos — match perfeito)
- `distance = 0.4` → `score = 0.6` (moderadamente similar)
- `distance = 1.0` → `score = 0.0` (ortogonais — sem relação semântica)
- `distance = 1.5` → `score = 0.0` (clamped — nunca score negativo)

Quando a metadata do Weaviate não retorna uma distância válida (pode ocorrer em edge cases do cliente), o sistema retorna `0.0` de forma defensiva — nunca assume um score alto sem evidência. Isso evita falsos positivos na recuperação de contexto.

### Extração da Distância do Metadata

O cliente Weaviate v4 pode retornar a distância de formas diferentes dependendo da versão e configuração — como `float` direto ou como objeto com atributo `.value`. O sistema lida com ambos os casos:

```python
def extract_distance_from_metadata(metadata: Any) -> Optional[float]:
    raw = getattr(metadata, "distance", None)
    if raw is None:
        return None
    if hasattr(raw, "value"):    # Objeto com .value
        v = raw.value
        return float(v) if v is not None else None
    return float(raw)            # Float direto
```

---

## Recuperação de Arquivos com Base em Relevância

### Estratégia Híbrida: Listagem + Busca Semântica

O `ContextService` implementa uma estratégia diferente para schemas e queries, executadas em **paralelo com `asyncio.gather`**:

```python
schema_task = self._load_full_schema_catalog()       # Listagem completa
query_task = self.vector_store_client.search(request) # Busca semântica

schema_results, query_response = await asyncio.gather(schema_task, query_task)
```

**Para schemas:** A lógica é de catálogo completo. O sistema lista todos os documentos da coleção `database_schemas` (até o limite configurado em `schema_catalog_max_fetch`, padrão 500) e os entrega todos ao agente. O raciocínio é que o agente de SQL Federado precisa conhecer todos os bancos disponíveis para fazer joins cross-database. O `relevance_score` de schemas é sempre `1.0` — são sempre relevantes, pois definem o universo de dados.

```python
async def _load_full_schema_catalog(self) -> List[SchemaResult]:
    docs = await self.vector_store_client.list_documents(
        self.settings.schema_collection, max_fetch=cap
    )
    # Desduplicação: última versão por database_id prevalece
    by_db: Dict[str, SchemaResult] = {}
    for doc in docs:
        db_id = doc.metadata.get("database_id") or doc.id
        by_db[db_id] = SchemaResult(...)  # Sobrescreve entradas duplicadas
```

**Para queries validadas:** Aqui sim opera a busca semântica por similaridade. A consulta do usuário em NL é convertida em embedding e comparada contra todos os vetores da coleção `validated_queries`. Apenas queries com score acima do `min_relevance_score` (padrão `0.6` em produção) são incluídas na resposta:

```python
query_request = VectorStoreSearchRequest(
    query=request.natural_language_query,
    collection=self.settings.query_collection,
    top_k=max_results,
    min_score=min_score,  # Score mínimo para filtrar resultados pouco relevantes
)
```

### Filtragem Pós-Busca no Weaviate

Após receber os resultados do Weaviate, o cliente aplica dois filtros adicionais em memória:

1. **Filtro por `min_score`**: Descarta documentos com score de similaridade abaixo do threshold.
2. **Filtro por metadados (`filter`)**: Permite filtrar por campos específicos do `metadata` (ex: `user_id`, `database_id`).

```python
if request.min_score is not None and score < request.min_score:
    continue
if request.filter:
    if not all(doc.metadata.get(k) == v for k, v in request.filter.items()):
        continue
```

### Resposta Formatada com Ranking e Metadados

Os resultados são ordenados por score (o Weaviate já retorna na ordem de distância crescente, equivalente a score decrescente) e montados como `QueryResult` com metadados de relevância explícitos:

```python
for rank, result in enumerate(query_response.results, start=1):
    query_results.append(QueryResult(
        id=result.id,
        natural_language_query=metadata.get("natural_language_query"),
        sql_query=metadata.get("sql_query"),
        similarity=result.score,  # Score [0,1] explícito
        rank=rank,                # Posição no ranking
        validated_at=metadata.get("validated_at"),
    ))
```

A resposta final inclui também metadados de diagnóstico:

```python
ContextResponseMetadata(
    total_schemas_found=len(schema_results),
    total_queries_found=query_response.total,
    limit_applied=max_results,
    search_time_ms=search_time_ms,  # Tempo total da operação em ms
)
```

---

## Aprendizado Contínuo: O Ciclo de Feedback

Um dos diferenciais do RAG Orchestrator é o mecanismo de aprendizado contínuo. Quando um usuário valida que uma resposta SQL gerada pelo agente está correta, o sistema persiste esse par NL→SQL no banco vetorial:

1. O backend chama `POST /api/v1/queries/validate` com a query NL, o SQL e o contexto utilizado.
2. O `QueryService` gera um ID determinístico (SHA-256 da NL normalizada).
3. Verifica se já existe um documento com esse ID (via `get_document`).
4. Se existir: faz **update** mesclando os metadados (mantendo campos históricos).
5. Se não existir: faz **insert** com o novo documento.
6. O embedding é gerado automaticamente pelo `VectorStoreClientEmbeddingWrapper` a partir do texto NL.

Na próxima vez que um usuário fizer uma pergunta semanticamente similar, essa query validada será recuperada com alto score de similaridade e injetada no contexto do agente — que pode usá-la como exemplo de few-shot para gerar SQL mais preciso.

---

## Qualidade de Código e Testabilidade

O projeto foi projetado com testabilidade em mente desde o início:

**Interface abstrata como contrato:** `VectorStoreClient` é uma ABC (Abstract Base Class) com todos os métodos como `@abstractmethod`. Os testes podem substituir qualquer implementação por mocks sem alterar nada no código dos services.

**MockVectorStoreClient:** Uma implementação em memória (`mock_vector_store_client.py`) que simula todas as operações do banco vetorial. Ativada automaticamente quando `VECTOR_STORE_URL` é `"mock"`.

**Lazy loading do modelo:** O `SentenceTransformerEmbeddingService` só carrega o modelo quando `embed()` é chamado — e o mock nunca o chama.

**Tratamento de erros estruturado:** Todos os endpoints capturam exceções e as convertem em `ErrorResponse` padronizados com código HTTP apropriado (`503` para banco indisponível, `400` para validação, `500` para erros internos).

**Configuração por variáveis de ambiente:** Todas as configurações críticas (URL do banco, modelo de embedding, limites) são externalizadas via `.env`, seguindo os princípios do 12-Factor App.

---

## Conclusão

O RAG Orchestrator do projeto Delfos é um microsserviço bem arquitetado que demonstra boas práticas de engenharia em sistemas RAG:

A **separação por responsabilidade** é clara — a API não sabe sobre embeddings, os services não sabem sobre o banco vetorial concreto, e o Weaviate client não sabe sobre a lógica de negócio. O **padrão Decorator** (`VectorStoreClientEmbeddingWrapper`) garante que o mesmo modelo seja usado para indexação e busca sem acoplamento. A **estratégia híbrida** de listagem completa para schemas e busca semântica para queries reflete uma compreensão profunda do domínio: schemas definem o universo de dados (sempre relevantes), enquanto queries são recuperadas por afinidade semântica com a intenção do usuário.

O mecanismo de **IDs determinísticos** via SHA-256 e UUID5 garante idempotência nas operações de upsert sem necessidade de consultas extras ao banco. E a **conversão conservadora de distância em score** (retornando `0.0` quando não há medida) evita falsos positivos que contaminariam o contexto entregue ao agente.

Em conjunto, esses elementos formam um sistema de recuperação de contexto robusto, extensível e alinhado com a missão do projeto Delfos: tornar a tradução de linguagem natural para SQL Federado tão precisa e contextualizada quanto possível.
