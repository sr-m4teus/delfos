"""Main FastAPI application for RAG Orchestrator."""

import sys
from pathlib import Path

# Adicionar o diretório raiz ao PYTHONPATH se necessário
# Isso permite executar o script tanto do diretório raiz quanto de dentro de src/
root_dir = Path(__file__).parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
from datetime import datetime

from src.config.settings import Settings
from src.api.dependencies import get_settings
from src.api.models.error_response import ErrorResponse, ErrorDetail
from src.api.routes import context, schemas, queries

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize settings
settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="RAG Orchestrator API for providing context to SQL translation agents",
)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with standardized error response."""
    logger.error(f"HTTP {exc.status_code}: {exc.detail}")
    
    # Parse error code from detail if present (format: "CODE: message")
    detail_str = str(exc.detail)
    if ":" in detail_str:
        parts = detail_str.split(":", 1)
        error_code = parts[0].strip()
        error_message = parts[1].strip()
    else:
        error_code = f"HTTP_{exc.status_code}"
        error_message = detail_str
    
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=ErrorDetail(
                code=error_code,
                message=error_message,
                details={"path": str(request.url.path)},
            )
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions with standardized error response."""
    logger.exception(f"Unexpected error: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error=ErrorDetail(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected error occurred",
                details={"path": str(request.url.path)},
            )
        ).model_dump(),
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns:
        Status of the API and vector store connectivity
    """
    try:
        # TODO: Check vector store connectivity when client is implemented
        # vector_store_client = get_vector_store_client()
        # await vector_store_client.health_check()
        vector_store_status = "not_implemented"

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": settings.api_version,
            "vector_store_status": vector_store_status,
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content=ErrorResponse(
                error=ErrorDetail(
                    code="SERVICE_UNAVAILABLE",
                    message="Service health check failed",
                    details={"error": str(e)},
                )
            ).model_dump(),
        )


# Register routers
app.include_router(context.router)
app.include_router(schemas.router)
app.include_router(queries.router)

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
