"""Validated query models for API."""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class ValidatedQueryInput(BaseModel):
    """Input para marcar consulta como válida."""

    natural_language_query: str = Field(
        ..., description="Consulta em linguagem natural", min_length=1
    )
    sql_query: str = Field(..., description="SQL gerado correspondente", min_length=1)
    context_used: Optional[Dict[str, Any]] = Field(
        None, description="Contexto utilizado na geração"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Metadados adicionais"
    )


class ValidatedQueryResponse(BaseModel):
    """Resposta após marcar consulta como válida."""

    id: str = Field(..., description="Identificador único da consulta validada")
    validated_at: datetime = Field(..., description="Timestamp de validação")
    success: bool = Field(..., description="Indica se a validação foi bem-sucedida")
    updated_existing: bool = Field(
        False,
        description="True se já existia documento com a mesma NL e foi atualizado",
    )


class QueryHistoryItem(BaseModel):
    """Item de histórico de consultas validadas por usuário."""

    id: str = Field(..., description="Identificador da consulta (query_id)")
    natural_language_query: str = Field(..., description="Pergunta em linguagem natural")
    sql_query: str = Field(..., description="SQL associado")
    validated_at: datetime = Field(..., description="Momento do registro")
    tables: Optional[List[str]] = Field(
        None, description="Tabelas referenciadas (quando disponível)"
    )
    catalog: Optional[str] = None
    schema: Optional[str] = None


class QueryHistoryListResponse(BaseModel):
    """Lista paginada de histórico."""

    items: List[QueryHistoryItem] = Field(default_factory=list)
    total_returned: int = Field(
        0, description="Quantidade de itens retornados após filtro"
    )
