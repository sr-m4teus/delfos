"""Mock implementation of VectorStoreClient for development and testing."""

import json
from typing import Dict, Any, List, Optional
from src.services.vector_store_client import (
    VectorStoreClient,
    VectorStoreDocument,
    VectorStoreSearchRequest,
    VectorStoreSearchResponse,
    VectorStoreSearchResult,
)


class MockVectorStoreClient(VectorStoreClient):
    """
    Mock implementation of VectorStoreClient.

    Stores documents in memory for development and testing.
    When the actual vector store is implemented, replace this with
    a real implementation that communicates with the vector database.
    """

    def __init__(self):
        """Initialize mock storage."""
        # In-memory storage: collection_name -> {document_id -> document}
        self._storage: Dict[str, Dict[str, VectorStoreDocument]] = {}

    def _get_collection(self, collection: str) -> Dict[str, VectorStoreDocument]:
        """Get or create collection storage."""
        if collection not in self._storage:
            self._storage[collection] = {}
        return self._storage[collection]

    async def search(
        self, request: VectorStoreSearchRequest
    ) -> VectorStoreSearchResponse:
        """
        Mock search implementation.

        Performs simple text matching on document content.
        Returns results sorted by a mock relevance score.
        """
        collection_storage = self._get_collection(request.collection)
        results: List[VectorStoreSearchResult] = []

        query_lower = request.query.lower()
        query_words = set(query_lower.split())

        for doc_id, document in collection_storage.items():
            # Simple text matching for mock
            content_lower = document.content.lower()
            content_words = set(content_lower.split())

            # Calculate mock relevance score based on word overlap
            if query_words:
                overlap = len(query_words & content_words)
                score = min(overlap / len(query_words), 1.0)
            else:
                score = 0.0

            # Apply min_score filter
            if request.min_score is not None and score < request.min_score:
                continue

            # Check metadata filters if provided
            if request.filter:
                matches = all(
                    document.metadata.get(k) == v for k, v in request.filter.items()
                )
                if not matches:
                    continue

            results.append(
                VectorStoreSearchResult(
                    id=doc_id, score=score, document=document
                )
            )

        # Sort by score descending and limit to top_k
        results.sort(key=lambda x: x.score, reverse=True)
        results = results[: request.top_k]

        return VectorStoreSearchResponse(
            results=results, total=len(collection_storage)
        )

    async def insert_document(
        self, collection: str, document: VectorStoreDocument
    ) -> Dict[str, Any]:
        """Mock insert implementation - stores document in memory."""
        collection_storage = self._get_collection(collection)
        collection_storage[document.id] = document
        return {
            "id": document.id,
            "success": True,
            "message": "Document inserted successfully",
        }

    async def update_document(
        self, collection: str, document_id: str, document: VectorStoreDocument
    ) -> Dict[str, Any]:
        """Mock update implementation - updates document in memory."""
        collection_storage = self._get_collection(collection)
        if document_id not in collection_storage:
            raise ValueError(f"Document {document_id} not found in collection {collection}")
        collection_storage[document_id] = document
        return {
            "id": document_id,
            "success": True,
            "message": "Document updated successfully",
        }

    async def get_document(
        self, collection: str, document_id: str
    ) -> Optional[VectorStoreDocument]:
        """Mock get document implementation."""
        collection_storage = self._get_collection(collection)
        return collection_storage.get(document_id)

    async def list_documents(
        self, collection: str, max_fetch: int = 500
    ) -> List[VectorStoreDocument]:
        """Lista documentos da coleção (sem ordem garantida; histórico reordena no serviço)."""
        collection_storage = self._get_collection(collection)
        docs = list(collection_storage.values())
        return docs[:max_fetch]

    async def health_check(self) -> Dict[str, Any]:
        """Mock health check implementation."""
        return {"status": "healthy", "version": "1.0.0"}
