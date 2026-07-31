"""Vector Store Client interface for communication with vector database."""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class VectorStoreDocument(BaseModel):
    """Documento armazenado no banco vetorial."""

    id: str
    content: str  # Texto do schema ou consulta
    metadata: Dict[str, Any]  # Metadados (database_id, query_id, etc.)
    embedding: Optional[List[float]] = None  # Embedding (gerado pelo banco vetorial)


class VectorStoreSearchRequest(BaseModel):
    """Requisição de busca no banco vetorial."""

    query: str  # Consulta em linguagem natural
    collection: str  # Coleção/índice a buscar
    top_k: int = 10  # Número de resultados
    min_score: Optional[float] = None  # Score mínimo
    filter: Optional[Dict[str, Any]] = None  # Filtros adicionais
    # Vetor da query (obrigatório quando o banco usa vectorizer 'none', ex.: Weaviate)
    query_embedding: Optional[List[float]] = None


class VectorStoreSearchResult(BaseModel):
    """Resultado individual de busca."""

    id: str
    score: float  # Score de similaridade
    document: VectorStoreDocument


class VectorStoreSearchResponse(BaseModel):
    """Resposta de busca do banco vetorial."""

    results: List[VectorStoreSearchResult]
    total: int  # Total de resultados encontrados


class VectorStoreClient(ABC):
    """Interface abstrata para cliente do banco vetorial."""

    @abstractmethod
    async def search(
        self, request: VectorStoreSearchRequest
    ) -> VectorStoreSearchResponse:
        """
        Busca documentos similares usando busca semântica.

        Args:
            request: Requisição de busca com query, collection, top_k, etc.

        Returns:
            Resposta com resultados ordenados por relevância

        Raises:
            Exception: Se o banco vetorial estiver indisponível ou retornar erro
        """
        pass

    @abstractmethod
    async def insert_document(
        self, collection: str, document: VectorStoreDocument
    ) -> Dict[str, Any]:
        """
        Insere um documento na coleção especificada.

        Args:
            collection: Nome da coleção
            document: Documento a ser inserido

        Returns:
            Resposta com id e status de sucesso

        Raises:
            Exception: Se houver erro ao inserir
        """
        pass

    @abstractmethod
    async def update_document(
        self, collection: str, document_id: str, document: VectorStoreDocument
    ) -> Dict[str, Any]:
        """
        Atualiza um documento existente.

        Args:
            collection: Nome da coleção
            document_id: ID do documento a atualizar
            document: Documento atualizado

        Returns:
            Resposta com status de sucesso

        Raises:
            Exception: Se houver erro ao atualizar
        """
        pass

    @abstractmethod
    async def list_documents(
        self, collection: str, max_fetch: int = 500
    ) -> List[VectorStoreDocument]:
        """
        Lista documentos da coleção (ordem definida pelo backend vetorial).

        Usado para histórico com filtro pós-processamento (ex.: por user_id).

        Args:
            collection: Nome da coleção
            max_fetch: Limite máximo de objetos a retornar

        Returns:
            Lista de documentos com content e metadata preenchidos
        """
        pass

    @abstractmethod
    async def get_document(
        self, collection: str, document_id: str
    ) -> Optional[VectorStoreDocument]:
        """
        Obtém um documento específico por ID.

        Args:
            collection: Nome da coleção
            document_id: ID do documento

        Returns:
            Documento encontrado ou None se não existir

        Raises:
            Exception: Se houver erro ao buscar
        """
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """
        Verifica se o banco vetorial está disponível.

        Returns:
            Status de saúde do banco vetorial

        Raises:
            Exception: Se o banco vetorial estiver indisponível
        """
        pass
