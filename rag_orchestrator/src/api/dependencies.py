"""Shared dependencies for API routes."""

from functools import lru_cache
from typing import Optional
from src.config.settings import Settings
from src.services.vector_store_client import VectorStoreClient
from src.services.mock_vector_store_client import MockVectorStoreClient
from src.services.weaviate_vector_store_client import WeaviateVectorStoreClient
from src.services.embedding_service import (
    EmbeddingService,
    SentenceTransformerEmbeddingService,
)
from src.services.vector_store_client_embedding_wrapper import (
    VectorStoreClientEmbeddingWrapper,
)

# Global instance (singleton pattern)
_vector_store_client: Optional[VectorStoreClient] = None
_embedding_service: Optional[EmbeddingService] = None


@lru_cache()
def get_settings() -> Settings:
    """
    Get application settings (cached).

    Returns:
        Settings instance loaded from environment variables
    """
    return Settings()


def get_embedding_service() -> Optional[EmbeddingService]:
    """
    Get embedding service instance when using Weaviate (vectorizer 'none').

    Returns None when vector store is mock, so tests do not load the model.
    """
    global _embedding_service
    if _embedding_service is None:
        settings = get_settings()
        url = (settings.vector_store_url or "").strip().lower()
        if url and url != "mock":
            _embedding_service = SentenceTransformerEmbeddingService(settings)
    return _embedding_service


def get_vector_store_client() -> VectorStoreClient:
    """
    Get vector store client instance.

    When using Weaviate, wraps with VectorStoreClientEmbeddingWrapper so
    the same embedding model is used for insert and search. Use mock when
    URL is empty or 'mock'.
    """
    global _vector_store_client
    if _vector_store_client is None:
        settings = get_settings()
        url = (settings.vector_store_url or "").strip().lower()
        if url and url != "mock":
            raw_client = WeaviateVectorStoreClient(settings)
            embedding_svc = get_embedding_service()
            if embedding_svc is not None:
                _vector_store_client = VectorStoreClientEmbeddingWrapper(
                    embedding_svc, raw_client
                )
            else:
                _vector_store_client = raw_client
        else:
            _vector_store_client = MockVectorStoreClient()
    return _vector_store_client
