"""Wrapper do VectorStoreClient que preenche embeddings antes de delegar."""

from typing import Dict, Any, List, Optional

from src.services.embedding_service import EmbeddingService
from src.services.vector_store_client import (
    VectorStoreClient,
    VectorStoreDocument,
    VectorStoreSearchRequest,
    VectorStoreSearchResponse,
)


class VectorStoreClientEmbeddingWrapper(VectorStoreClient):
    """
    Wrapper que usa EmbeddingService para preencher document.embedding e
    request.query_embedding quando ausentes, garantindo o mesmo modelo em insert e search.
    """

    def __init__(self, embedding_service: EmbeddingService, client: VectorStoreClient) -> None:
        self._embedding_service = embedding_service
        self._client = client

    async def search(
        self, request: VectorStoreSearchRequest
    ) -> VectorStoreSearchResponse:
        if request.query_embedding is None:
            request.query_embedding = await self._embedding_service.embed(
                request.query
            )
        return await self._client.search(request)

    async def insert_document(
        self, collection: str, document: VectorStoreDocument
    ) -> Dict[str, Any]:
        if document.embedding is None:
            document.embedding = await self._embedding_service.embed(
                document.content
            )
        return await self._client.insert_document(collection, document)

    async def update_document(
        self, collection: str, document_id: str, document: VectorStoreDocument
    ) -> Dict[str, Any]:
        if document.embedding is None:
            document.embedding = await self._embedding_service.embed(
                document.content
            )
        return await self._client.update_document(
            collection, document_id, document
        )

    async def get_document(
        self, collection: str, document_id: str
    ) -> Optional[VectorStoreDocument]:
        return await self._client.get_document(collection, document_id)

    async def list_documents(
        self, collection: str, max_fetch: int = 500
    ) -> List[VectorStoreDocument]:
        return await self._client.list_documents(collection, max_fetch)

    async def health_check(self) -> Dict[str, Any]:
        return await self._client.health_check()
