"""Context request models for API."""

from pydantic import BaseModel, Field
from typing import Optional


class ContextRequest(BaseModel):
    """Solicitação de contexto para tradução de consulta."""

    natural_language_query: str = Field(
        ...,
        description="Consulta em linguagem natural do usuário",
        min_length=1,
        max_length=1000,
    )
    max_results: Optional[int] = Field(
        default=10,
        description="Número máximo de resultados por tipo (schemas/queries)",
        ge=1,
        le=100,
    )
    min_relevance_score: Optional[float] = Field(
        default=0.6,
        description="Score mínimo para incluir consultas exemplo (schemas vêm completos, fora deste filtro)",
        ge=0.0,
        le=1.0,
    )
    fk_expansion_depth: Optional[int] = Field(
        default=None,
        description="Profundidade BFS no grafo FK. Default vem das settings (FK_EXPANSION_DEPTH).",
        ge=0,
        le=10,
    )
