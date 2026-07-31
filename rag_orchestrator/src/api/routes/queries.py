"""Query endpoints for validating queries."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from src.api.models.validated_query import (
    ValidatedQueryInput,
    ValidatedQueryResponse,
    QueryHistoryListResponse,
)
from src.api.dependencies import get_settings, get_vector_store_client
from src.config.settings import Settings
from src.services.vector_store_client import VectorStoreClient
from src.services.query_service import QueryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["queries"])


@router.get(
    "/queries/history",
    response_model=QueryHistoryListResponse,
    summary="Histórico de consultas por usuário",
    description="Lista consultas validadas armazenadas no RAG para o user_id informado "
    "(uso interno pelo backend Delfos com o sub do JWT).",
)
async def list_query_history(
    user_id: str = Query(..., min_length=1, description="Identificador do usuário (JWT sub)"),
    limit: int = Query(50, ge=1, le=100, description="Máximo de itens"),
    settings: Settings = Depends(get_settings),
    vector_store_client: VectorStoreClient = Depends(get_vector_store_client),
) -> QueryHistoryListResponse:
    try:
        query_service = QueryService(vector_store_client, settings)
        items = await query_service.list_history_for_user(user_id, limit)
        return QueryHistoryListResponse(items=items, total_returned=len(items))
    except Exception as e:
        logger.error(f"Erro ao listar histórico de consultas: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"VECTOR_STORE_ERROR: Erro ao listar histórico - {str(e)}",
        )


@router.post(
    "/queries/validate",
    response_model=ValidatedQueryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Marcar consulta como válida",
    description="Marca uma consulta como válida para aprendizado contínuo, "
    "armazenando a associação entre consulta em linguagem natural, SQL gerado e contexto utilizado",
)
async def validate_query(
    query_input: ValidatedQueryInput,
    settings: Settings = Depends(get_settings),
    vector_store_client: VectorStoreClient = Depends(get_vector_store_client),
) -> ValidatedQueryResponse:
    """
    Mark a query as validated for continuous learning.

    If the same natural language text (after strip) already exists,
    the document is updated instead of inserting a duplicate.

    Args:
        query_input: Query input with natural language query, SQL, and context
        settings: Application settings
        vector_store_client: Vector store client instance

    Returns:
        ValidatedQueryResponse with validation details

    Raises:
        HTTPException: If validation fails
    """
    try:
        query_service = QueryService(vector_store_client, settings)
        response = await query_service.validate_query(query_input)

        logger.info(
            f"Consulta validada com sucesso: {response.id} "
            f"(atualização: {response.updated_existing})"
        )

        return response

    except Exception as e:
        logger.error(f"Erro ao validar consulta: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"VECTOR_STORE_ERROR: Erro ao validar consulta no banco vetorial - {str(e)}",
        )
