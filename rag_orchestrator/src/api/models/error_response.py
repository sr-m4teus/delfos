"""Error response models for API."""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class ErrorDetail(BaseModel):
    """Detalhes de um erro."""

    code: str = Field(..., description="Código do erro")
    message: str = Field(..., description="Mensagem de erro")
    details: Optional[Dict[str, Any]] = Field(
        None, description="Detalhes adicionais do erro"
    )


class ErrorResponse(BaseModel):
    """Resposta de erro padronizada."""

    error: ErrorDetail = Field(..., description="Detalhes do erro")
