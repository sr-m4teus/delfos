"""Query service for managing validated queries."""

import hashlib
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from src.api.models.validated_query import (
    ValidatedQueryInput,
    ValidatedQueryResponse,
    QueryHistoryItem,
)
from src.services.vector_store_client import (
    VectorStoreClient,
    VectorStoreDocument,
)
from src.config.settings import Settings

logger = logging.getLogger(__name__)


class QueryService:
    """Service for validating and managing queries."""

    def __init__(self, vector_store_client: VectorStoreClient, settings: Settings):
        """
        Initialize QueryService.

        Args:
            vector_store_client: Client for vector store communication
            settings: Application settings
        """
        self.vector_store_client = vector_store_client
        self.settings = settings

    def _generate_query_id(self, natural_language_query: str) -> str:
        """
        ID estável por texto NL (após strip), para no máximo um documento por pergunta.

        A chave semântica/embeddável é só a NL; o SQL fica em metadata.
        """
        normalized_nl = natural_language_query.strip()
        query_hash = hashlib.sha256(normalized_nl.encode("utf-8")).hexdigest()[:16]
        return f"query_{query_hash}"

    async def check_duplicate(
        self, query_input: ValidatedQueryInput
    ) -> Optional[str]:
        """
        Retorna o ID se já existir documento para esta NL (após strip).
        """
        query_id = self._generate_query_id(query_input.natural_language_query)

        existing_doc = await self.vector_store_client.get_document(
            self.settings.query_collection, query_id
        )

        return query_id if existing_doc is not None else None

    def _query_to_document(
        self, query_input: ValidatedQueryInput, query_id: str
    ) -> VectorStoreDocument:
        """
        Monta o documento: content = chave NL (nunca SQL); metadata = valor (sql_query) e extras.

        O embedding é sempre gerado a partir de `content` (NL), alinhado ao modelo chave/valor.
        """
        nl_stripped = query_input.natural_language_query.strip()
        content = nl_stripped

        # Build metadata
        metadata = {
            "query_id": query_id,
            "natural_language_query": nl_stripped,
            "sql_query": query_input.sql_query,
            "validated_at": datetime.utcnow().isoformat(),
            "query_type": "validated_query",
        }

        # Add context_used if provided
        if query_input.context_used:
            metadata["context_used"] = query_input.context_used

        # Merge additional metadata
        if query_input.metadata:
            metadata.update(query_input.metadata)

        return VectorStoreDocument(
            id=query_id,
            content=content,
            metadata=metadata,
        )

    async def validate_query(
        self, query_input: ValidatedQueryInput
    ) -> ValidatedQueryResponse:
        """
        Validate and store a query for continuous learning.

        If query already exists, updates it instead of creating duplicate (FR-004).

        Args:
            query_input: Query input to validate

        Returns:
            ValidatedQueryResponse with validation details

        Raises:
            Exception: If vector store operation fails
        """
        query_id = self._generate_query_id(query_input.natural_language_query)

        existing_doc = await self.vector_store_client.get_document(
            self.settings.query_collection, query_id
        )

        document = self._query_to_document(query_input, query_id)

        if existing_doc is not None:
            old_meta = existing_doc.metadata or {}
            merged = {**old_meta, **document.metadata}
            if merged.get("user_id") is None and old_meta.get("user_id"):
                merged["user_id"] = old_meta["user_id"]
            document = VectorStoreDocument(
                id=document.id,
                content=document.content,
                metadata=merged,
            )

        validated_at = datetime.utcnow()
        was_update = existing_doc is not None

        if was_update:
            # Update existing query (mesma NL)
            logger.info(f"Atualizando consulta validada existente: {query_id}")
            result = await self.vector_store_client.update_document(
                self.settings.query_collection, query_id, document
            )
        else:
            # Insert new query
            logger.info(f"Registrando nova consulta validada: {query_id}")
            result = await self.vector_store_client.insert_document(
                self.settings.query_collection, document
            )

        return ValidatedQueryResponse(
            id=query_id,
            validated_at=validated_at,
            success=result.get("success", True),
            updated_existing=was_update,
        )

    @staticmethod
    def _parse_validated_at(meta: dict) -> datetime:
        raw = meta.get("validated_at")
        if raw is None:
            return datetime.min.replace(tzinfo=timezone.utc)
        if isinstance(raw, datetime):
            return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
        s = str(raw).replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)

    async def list_history_for_user(
        self, user_id: str, limit: int = 50
    ) -> List[QueryHistoryItem]:
        """
        Lista histórico de consultas validadas para um usuário.

        Busca até max_fetch documentos na coleção e filtra por metadata.user_id.
        """
        limit = max(1, min(limit, 100))
        max_fetch = min(1000, max(limit * 25, 150))

        docs = await self.vector_store_client.list_documents(
            self.settings.query_collection, max_fetch=max_fetch
        )

        candidates: List[Tuple[datetime, QueryHistoryItem]] = []

        for doc in docs:
            meta = doc.metadata or {}
            if meta.get("user_id") != user_id:
                continue
            if meta.get("query_type") != "validated_query":
                continue
            sql = meta.get("sql_query")
            if not sql or not str(sql).strip():
                continue
            nl = (meta.get("natural_language_query") or doc.content or "").strip()
            qid = str(meta.get("query_id") or doc.id)
            validated = self._parse_validated_at(meta)
            tables = meta.get("tables")
            if tables is not None and not isinstance(tables, list):
                tables = None
            catalog = meta.get("catalog")
            schema_name = meta.get("schema")
            catalog = str(catalog) if catalog is not None else None
            schema_name = str(schema_name) if schema_name is not None else None

            item = QueryHistoryItem(
                id=qid,
                natural_language_query=nl or "(sem texto)",
                sql_query=str(sql).strip(),
                validated_at=validated,
                tables=tables,
                catalog=catalog,
                schema=schema_name,
            )
            candidates.append((validated, item))

        candidates.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in candidates[:limit]]
