"""Context response models for API."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class SchemaResult(BaseModel):
    """Schema de banco de dados relevante."""

    database_id: str = Field(..., description="Identificador do banco de dados")
    database_name: Optional[str] = Field(None, description="Nome do banco de dados")
    schema: Dict[str, Any] = Field(..., description="Schema completo do banco de dados")
    relevance_score: float = Field(
        ..., description="Score de relevância (0.0 a 1.0)", ge=0.0, le=1.0
    )
    rank: int = Field(..., description="Posição no ranking de relevância", ge=1)


class QueryResult(BaseModel):
    """Consulta validada relevante."""

    id: str = Field(..., description="Identificador único da consulta validada")
    natural_language_query: str = Field(
        ..., description="Consulta original em linguagem natural"
    )
    sql_query: str = Field(..., description="SQL gerado correspondente")
    similarity: float = Field(
        ...,
        description="Similaridade semântica entre a NL do usuário e a chave NL armazenada (0.0 a 1.0)",
        ge=0.0,
        le=1.0,
    )
    rank: int = Field(..., description="Posição no ranking de relevância", ge=1)
    validated_at: Optional[datetime] = Field(None, description="Timestamp de validação")


class ContextResponseMetadata(BaseModel):
    """Metadados da resposta de contexto."""

    total_schemas_found: int = Field(
        ..., description="Total de schemas encontrados", ge=0
    )
    total_queries_found: int = Field(
        ..., description="Total de consultas encontradas", ge=0
    )
    limit_applied: int = Field(..., description="Limite aplicado aos resultados", ge=1)
    search_time_ms: Optional[float] = Field(
        None, description="Tempo de busca em milissegundos"
    )


class ContextResponse(BaseModel):
    """Resposta de contexto padronizada."""

    schemas: List[SchemaResult] = Field(
        default_factory=list, description="Schemas relevantes"
    )
    queries: List[QueryResult] = Field(
        default_factory=list, description="Consultas relacionadas"
    )
    metadata: ContextResponseMetadata = Field(..., description="Metadados da busca")
