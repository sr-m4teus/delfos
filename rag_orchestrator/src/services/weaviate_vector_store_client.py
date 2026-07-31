"""Weaviate implementation of VectorStoreClient."""

import asyncio
import json
import logging
import uuid as uuid_lib
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

import weaviate
from weaviate.classes.config import Configure, Property, DataType
from weaviate.classes.init import Auth, AdditionalConfig, Timeout
from weaviate.classes.query import MetadataQuery
from weaviate.connect import ConnectionParams

from src.services.weaviate_similarity import (
    extract_distance_from_metadata,
    similarity_score_from_weaviate_distance,
)

from src.config.settings import Settings
from src.services.vector_store_client import (
    VectorStoreClient,
    VectorStoreDocument,
    VectorStoreSearchRequest,
    VectorStoreSearchResponse,
    VectorStoreSearchResult,
)

logger = logging.getLogger(__name__)

# Namespace para gerar UUIDs determinísticos a partir de document.id
_NAMESPACE_UUID = uuid_lib.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def _doc_id_to_weaviate_uuid(document_id: str) -> uuid_lib.UUID:
    """Gera um UUID Weaviate determinístico a partir do id do documento."""
    return uuid_lib.uuid5(_NAMESPACE_UUID, document_id)


def _parse_vector_store_url(url: str) -> tuple[str, int, bool]:
    """Extrai host, port e secure de VECTOR_STORE_URL (ex: http://localhost:8080)."""
    parsed = urlparse(url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 8080)
    secure = parsed.scheme == "https"
    return host, port, secure


class WeaviateVectorStoreClient(VectorStoreClient):
    """
    Cliente Weaviate que implementa VectorStoreClient.

    Usa vectorizer 'none': vetores são enviados pela aplicação.
    - insert_document/update_document: document.embedding é obrigatório.
    - search: request.query_embedding é obrigatório (busca por near_vector).
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: Optional[weaviate.WeaviateAsyncClient] = None
        self._collections_created: set[str] = set()

    async def _ensure_connected(self) -> weaviate.WeaviateAsyncClient:
        if self._client is not None:
            if self._client.is_connected():
                return self._client
            await self._client.connect()
            return self._client

        host, port, secure = _parse_vector_store_url(self._settings.vector_store_url)
        timeout_secs = int(max(1, self._settings.vector_store_timeout))
        timeout = Timeout(init=timeout_secs, query=timeout_secs, insert=timeout_secs)
        auth = (
            Auth.api_key(self._settings.vector_store_api_key)
            if self._settings.vector_store_api_key
            else None
        )

        if secure:
            # Weaviate Cloud (WCD): host gRPC difere do REST (grpc-<cluster>...).
            # O helper resolve gRPC host/porta sozinho; não derivar do REST host.
            self._client = weaviate.use_async_with_weaviate_cloud(
                cluster_url=self._settings.vector_store_url,
                auth_credentials=auth,
                additional_config=AdditionalConfig(timeout=timeout),
                skip_init_checks=False,
            )
        else:
            # Self-host local (Docker): REST e gRPC no mesmo host.
            connection_params = ConnectionParams.from_params(
                http_host=host,
                http_port=port,
                http_secure=secure,
                grpc_host=host,
                grpc_port=50051,
                grpc_secure=secure,
            )
            self._client = weaviate.WeaviateAsyncClient(
                connection_params=connection_params,
                auth_client_secret=auth,
                additional_config=AdditionalConfig(timeout=timeout),
                skip_init_checks=False,
            )
        await self._client.connect()
        return self._client

    async def _ensure_collection(self, collection: str) -> None:
        client = await self._ensure_connected()
        if collection in self._collections_created:
            return
        exists_result = client.collections.exists(collection)
        exists = await exists_result if asyncio.iscoroutine(exists_result) else exists_result
        if exists:
            self._collections_created.add(collection)
            return

        try:
            await client.collections.create(
                name=collection,
                vector_config=Configure.Vectors.self_provided(),
                properties=[
                    Property(name="content", data_type=DataType.TEXT),
                    Property(name="metadata", data_type=DataType.TEXT),
                ],
            )
            self._collections_created.add(collection)
            logger.info("Coleção Weaviate criada: %s", collection)
        except Exception as e:
            logger.exception("Erro ao criar coleção Weaviate: %s", e)
            raise

    def _to_document(self, obj: Any) -> VectorStoreDocument:
        raw = obj.properties if hasattr(obj, "properties") else {}
        props = dict(raw) if not isinstance(raw, dict) else raw
        content = props.get("content", "") or ""
        meta_str = props.get("metadata", "{}") or "{}"
        try:
            metadata = json.loads(meta_str)
        except json.JSONDecodeError:
            metadata = {}
        uid = str(obj.uuid) if hasattr(obj, "uuid") else ""
        raw_vector = getattr(obj, "vector", None)
        if isinstance(raw_vector, list):
            embedding = raw_vector
        elif isinstance(raw_vector, dict) and raw_vector:
            # Weaviate pode retornar vetor nomeado, ex.: {"default": [0.1, ...]}
            embedding = next(
                (v for v in raw_vector.values() if isinstance(v, list)),
                None,
            )
        else:
            embedding = None
        return VectorStoreDocument(
            id=uid,
            content=content,
            metadata=metadata,
            embedding=embedding,
        )

    async def search(
        self, request: VectorStoreSearchRequest
    ) -> VectorStoreSearchResponse:
        if not request.query_embedding:
            raise ValueError(
                "Com vectorizer 'none', query_embedding é obrigatório na requisição de busca."
            )
        client = await self._ensure_connected()
        await self._ensure_collection(request.collection)
        coll = client.collections.get(request.collection)

        try:
            response = await coll.query.near_vector(
                near_vector=request.query_embedding,
                limit=request.top_k,
                return_metadata=MetadataQuery(distance=True),
            )
        except Exception as e:
            logger.exception("Erro na busca Weaviate: %s", e)
            raise

        results: List[VectorStoreSearchResult] = []
        for obj in response.objects:
            dist = extract_distance_from_metadata(obj.metadata)
            score = similarity_score_from_weaviate_distance(dist)
            if dist is None:
                logger.debug(
                    "Objeto Weaviate sem distance na metadata; score=0 (evita falso 1.0). id=%s",
                    getattr(obj, "uuid", "?"),
                )
            if request.min_score is not None and score < request.min_score:
                continue
            doc = self._to_document(obj)
            doc.id = self._weaviate_uuid_to_doc_id(obj.uuid, request.collection, doc)
            if request.filter:
                if not all(doc.metadata.get(k) == v for k, v in request.filter.items()):
                    continue
            results.append(VectorStoreSearchResult(id=doc.id, score=score, document=doc))

        return VectorStoreSearchResponse(
            results=results,
            total=len(results),
        )

    def _weaviate_uuid_to_doc_id(
        self, weaviate_uuid: Any, collection: str, doc: VectorStoreDocument
    ) -> str:
        """Tenta recuperar o document id original; fallback para metadata ou uuid."""
        if doc.metadata.get("database_id"):
            return doc.metadata["database_id"]
        if doc.metadata.get("query_id"):
            return doc.metadata["query_id"]
        return str(weaviate_uuid)

    async def insert_document(
        self, collection: str, document: VectorStoreDocument
    ) -> Dict[str, Any]:
        client = await self._ensure_connected()
        await self._ensure_collection(collection)
        coll = client.collections.get(collection)

        if not document.embedding:
            raise ValueError(
                "Com vectorizer 'none', document.embedding é obrigatório ao inserir."
            )
        weaviate_uuid = _doc_id_to_weaviate_uuid(document.id)
        properties = {
            "content": document.content,
            "metadata": json.dumps(document.metadata, ensure_ascii=False),
        }

        try:
            await coll.data.insert(
                uuid=weaviate_uuid,
                properties=properties,
                vector=document.embedding,
            )
        except Exception as e:
            # "already exists" é esperado no fluxo de upsert (SchemaService._upsert_document
            # tenta insert e cai para update); não é um erro real, só ruído em log ERROR.
            if "already exists" in str(e).lower():
                logger.debug("Documento já existe, será atualizado via update: %s", document.id)
            else:
                logger.exception("Erro ao inserir documento no Weaviate: %s", e)
            raise

        return {
            "id": document.id,
            "success": True,
            "message": "Document inserted successfully",
        }

    async def update_document(
        self, collection: str, document_id: str, document: VectorStoreDocument
    ) -> Dict[str, Any]:
        client = await self._ensure_connected()
        await self._ensure_collection(collection)
        coll = client.collections.get(collection)

        if not document.embedding:
            raise ValueError(
                "Com vectorizer 'none', document.embedding é obrigatório ao atualizar."
            )
        weaviate_uuid = _doc_id_to_weaviate_uuid(document_id)
        properties = {
            "content": document.content,
            "metadata": json.dumps(document.metadata, ensure_ascii=False),
        }

        try:
            await coll.data.update(
                uuid=weaviate_uuid,
                properties=properties,
                vector=document.embedding,
            )
        except Exception as e:
            logger.exception("Erro ao atualizar documento no Weaviate: %s", e)
            raise

        return {
            "id": document_id,
            "success": True,
            "message": "Document updated successfully",
        }

    async def get_document(
        self, collection: str, document_id: str
    ) -> Optional[VectorStoreDocument]:
        client = await self._ensure_connected()
        exists_result = client.collections.exists(collection)
        exists = await exists_result if asyncio.iscoroutine(exists_result) else exists_result
        if not exists:
            return None
        coll = client.collections.get(collection)
        weaviate_uuid = _doc_id_to_weaviate_uuid(document_id)
        try:
            obj = await coll.query.fetch_object_by_id(weaviate_uuid)
        except Exception:
            return None
        if obj is None:
            return None
        doc = self._to_document(obj)
        doc.id = document_id
        return doc

    async def list_documents(
        self, collection: str, max_fetch: int = 500
    ) -> List[VectorStoreDocument]:
        client = await self._ensure_connected()
        exists_result = client.collections.exists(collection)
        exists = await exists_result if asyncio.iscoroutine(exists_result) else exists_result
        if not exists:
            return []
        coll = client.collections.get(collection)
        cap = max(1, min(max_fetch, 1000))
        try:
            response = await coll.query.fetch_objects(
                limit=cap,
                return_properties=["content", "metadata"],
            )
        except Exception as e:
            logger.exception("Erro ao listar documentos Weaviate: %s", e)
            raise

        docs: List[VectorStoreDocument] = []
        for obj in response.objects:
            doc = self._to_document(obj)
            doc.id = self._weaviate_uuid_to_doc_id(obj.uuid, collection, doc)
            docs.append(doc)
        return docs

    async def health_check(self) -> Dict[str, Any]:
        try:
            client = await self._ensure_connected()
            ready = await client.is_ready()
            if not ready:
                return {"status": "unhealthy", "message": "Weaviate not ready"}
            version = "unknown"
            if hasattr(client, "get_meta"):
                try:
                    meta = await client.get_meta()
                    version = getattr(meta, "version", version) or version
                except Exception:
                    pass
            return {"status": "healthy", "version": str(version)}
        except Exception as e:
            logger.exception("Health check Weaviate falhou: %s", e)
            raise
