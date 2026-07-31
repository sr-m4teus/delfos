"""Configuration settings for RAG Orchestrator."""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    """Configurações da aplicação."""

    # API Configuration
    api_title: str = "RAG Orchestrator API"
    api_version: str = "1.0.0"

    # Vector Store Configuration
    vector_store_url: str = Field(..., description="URL do banco vetorial")
    vector_store_timeout: float = Field(default=5.0, description="Timeout em segundos")
    vector_store_api_key: Optional[str] = Field(
        default=None, description="API Key para autenticação no banco vetorial"
    )

    # Collections
    schema_collection: str = Field(
        default="database_schemas", description="Nome da coleção para schemas (legacy catálogo-level)"
    )
    schema_tables_collection: str = Field(
        default="schema_tables",
        description="Nome da coleção para schemas em granularidade tabela (1 vetor por tabela)",
    )
    query_collection: str = Field(
        default="validated_queries", description="Nome da coleção para consultas validadas"
    )

    # Limits
    default_max_results: int = Field(
        default=10, description="Número padrão de resultados retornados", ge=1, le=100
    )
    max_max_results: int = Field(
        default=100, description="Número máximo de resultados permitidos", ge=1
    )
    default_min_relevance_score: float = Field(
        default=0.6,
        description="Score mínimo padrão para incluir consultas exemplo (busca semântica)",
        ge=0.0,
        le=1.0,
    )

    schema_catalog_max_fetch: int = Field(
        default=500,
        description="Máximo de documentos de schema a listar para enviar catálogo completo ao tradutor",
        ge=1,
        le=1000,
    )

    # FK graph expansion (table-level RAG)
    fk_expansion_depth: int = Field(
        default=2,
        description="Profundidade default da expansão BFS pelo grafo de FK",
        ge=0,
        le=10,
    )
    top_k_tables: int = Field(
        default=8,
        description="Top-K tabelas seed retornadas por similaridade antes da expansão FK",
        ge=1,
        le=100,
    )
    max_tables_after_expansion: int = Field(
        default=30,
        description="Cap de segurança no total de tabelas após expansão FK (evita explosão em hubs)",
        ge=1,
        le=500,
    )
    min_table_similarity_score: float = Field(
        default=0.3,
        description="Score mínimo para incluir tabela como seed da expansão",
        ge=0.0,
        le=1.0,
    )

    # Embedding (mesmo modelo para insert e search no vector store)
    embedding_model_name: str = Field(
        default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        description="Nome do modelo de embedding (local, usado em insert e search)",
    )
    embedding_device: str = Field(
        default="cpu",
        description="Device para inferência: 'cpu' ou 'cuda'",
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
