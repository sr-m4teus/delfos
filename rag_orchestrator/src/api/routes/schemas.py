"""Schema endpoints for managing database schemas."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Path
from src.api.models.database_schema import DatabaseSchemaInput, DatabaseSchemaResponse
from src.api.models.error_response import ErrorResponse, ErrorDetail
from src.api.dependencies import get_settings, get_vector_store_client
from src.config.settings import Settings
from src.services.vector_store_client import VectorStoreClient
from src.services.schema_service import SchemaService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["schemas"])


@router.post(
    "/schemas",
    response_model=DatabaseSchemaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar schema de banco de dados",
    description="Registra um novo schema de banco de dados alvo para uso em buscas de contexto",
)
async def register_schema(
    schema_input: DatabaseSchemaInput,
    settings: Settings = Depends(get_settings),
    vector_store_client: VectorStoreClient = Depends(get_vector_store_client),
) -> DatabaseSchemaResponse:
    """
    Register a new database schema.

    Args:
        schema_input: Schema input with database_id, schema structure, etc.
        settings: Application settings
        vector_store_client: Vector store client instance

    Returns:
        DatabaseSchemaResponse with registration details

    Raises:
        HTTPException: If schema is invalid or registration fails
    """
    try:
        schema_service = SchemaService(vector_store_client, settings)
        response = await schema_service.register_schema(schema_input)

        logger.info(f"Schema registrado com sucesso: {schema_input.database_id}")
        return response

    except ValueError as e:
        logger.warning(f"Schema inválido: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SCHEMA_VALIDATION_ERROR: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Erro ao registrar schema: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"VECTOR_STORE_ERROR: Erro ao registrar schema no banco vetorial - {str(e)}",
        )


@router.put(
    "/schemas/{database_id}",
    response_model=DatabaseSchemaResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar schema de banco de dados",
    description="Atualiza um schema de banco de dados existente, mantendo histórico de versões",
)
async def update_schema(
    database_id: str = Path(..., description="ID do banco de dados"),
    schema_input: DatabaseSchemaInput = ...,
    settings: Settings = Depends(get_settings),
    vector_store_client: VectorStoreClient = Depends(get_vector_store_client),
) -> DatabaseSchemaResponse:
    """
    Update an existing database schema.

    Args:
        database_id: ID of the database schema to update
        schema_input: Updated schema input
        settings: Application settings
        vector_store_client: Vector store client instance

    Returns:
        DatabaseSchemaResponse with update details

    Raises:
        HTTPException: If schema is invalid, database_id doesn't match, or update fails
    """
    try:
        schema_service = SchemaService(vector_store_client, settings)
        response = await schema_service.update_schema(database_id, schema_input)

        logger.info(f"Schema atualizado com sucesso: {database_id}")
        return response

    except ValueError as e:
        logger.warning(f"Schema inválido ou ID não corresponde: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SCHEMA_VALIDATION_ERROR: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Erro ao atualizar schema: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"VECTOR_STORE_ERROR: Erro ao atualizar schema no banco vetorial - {str(e)}",
        )
