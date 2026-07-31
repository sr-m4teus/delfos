"""Context endpoint for retrieving relevant schemas and queries."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from src.api.models.context_request import ContextRequest
from src.api.models.context_response import ContextResponse
from src.api.models.error_response import ErrorResponse, ErrorDetail
from src.api.dependencies import get_settings, get_vector_store_client
from src.config.settings import Settings
from src.services.vector_store_client import VectorStoreClient
from src.services.context_service import ContextService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["context"])


@router.post(
    "/context",
    response_model=ContextResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter contexto para tradução de consulta",
    description="Retorna contexto relevante (schemas de bancos de dados e consultas relacionadas) "
    "para uma consulta em linguagem natural",
)
async def get_context(
    request: ContextRequest,
    settings: Settings = Depends(get_settings),
    vector_store_client: VectorStoreClient = Depends(get_vector_store_client),
) -> ContextResponse:
    """
    Retrieve context for natural language query translation.

    This endpoint searches both schema and validated query collections
    and returns relevant results formatted for use by SQL translation agents.

    Args:
        request: Context request with natural language query
        settings: Application settings
        vector_store_client: Vector store client instance

    Returns:
        ContextResponse with relevant schemas and queries

    Raises:
        HTTPException: If vector store is unavailable or returns error
    """
    try:
        context_service = ContextService(vector_store_client, settings)
        response = await context_service.get_context(request)

        # Ensure empty arrays are returned (not None) - FR-013
        if not response.schemas:
            response.schemas = []
        if not response.queries:
            response.queries = []

        logger.info(
            f"Context retrieved: {len(response.schemas)} schemas, "
            f"{len(response.queries)} queries for query: {request.natural_language_query[:50]}"
        )

        return response

    except Exception as e:
        logger.error(f"Error retrieving context: {e}", exc_info=True)

        # Determine appropriate HTTP status code
        error_code = "VECTOR_STORE_ERROR"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE

        # Check if it's a connection/timeout error
        error_str = str(e).lower()
        if "timeout" in error_str or "connection" in error_str or "unavailable" in error_str:
            error_code = "VECTOR_STORE_UNAVAILABLE"
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        elif "not found" in error_str or "404" in error_str:
            error_code = "VECTOR_STORE_NOT_FOUND"
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        else:
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

        # Raise HTTPException - the exception handler will format it as ErrorResponse
        raise HTTPException(
            status_code=status_code,
            detail=f"{error_code}: Erro ao buscar contexto no banco vetorial - {str(e)}",
        )
