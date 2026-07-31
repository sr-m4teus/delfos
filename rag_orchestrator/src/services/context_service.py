"""Context service: top-K por similaridade + BFS no grafo FK até profundidade N."""

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Set, Tuple

from src.api.models.context_request import ContextRequest
from src.api.models.context_response import (
    ContextResponse,
    SchemaResult,
    QueryResult,
    ContextResponseMetadata,
)
from src.services.vector_store_client import (
    VectorStoreClient,
    VectorStoreDocument,
    VectorStoreSearchRequest,
)
from src.config.settings import Settings

logger = logging.getLogger(__name__)


class ContextService:
    """Recupera contexto: tabelas relevantes (similaridade + grafo FK) e queries similares."""

    def __init__(self, vector_store_client: VectorStoreClient, settings: Settings):
        self.vector_store_client = vector_store_client
        self.settings = settings

    @staticmethod
    def _parse_metadata(meta: Any) -> Dict[str, Any]:
        if isinstance(meta, dict):
            return meta
        if isinstance(meta, str):
            try:
                return json.loads(meta)
            except json.JSONDecodeError:
                return {}
        return {}

    def _build_graph(
        self, docs: List[VectorStoreDocument]
    ) -> Tuple[Dict[str, VectorStoreDocument], Dict[str, Set[str]], Dict[str, Set[str]]]:
        """
        Constrói índices em memória a partir dos documentos table-level.

        Retorna:
            by_fqn: fqn -> documento
            out_edges: fqn -> set de FQNs referenciadas (forward FK)
            in_edges: fqn -> set de FQNs que referenciam esta (reverse FK)
        """
        by_fqn: Dict[str, VectorStoreDocument] = {}
        out_edges: Dict[str, Set[str]] = defaultdict(set)
        in_edges: Dict[str, Set[str]] = defaultdict(set)

        for doc in docs:
            meta = self._parse_metadata(doc.metadata)
            fqn = meta.get("fqn") or doc.id
            if not fqn:
                continue
            by_fqn[fqn] = doc
            for fk in meta.get("foreign_keys", []) or []:
                if not isinstance(fk, dict):
                    continue
                ref_fqn = fk.get("ref_fqn")
                if not ref_fqn:
                    continue
                out_edges[fqn].add(ref_fqn)
                in_edges[ref_fqn].add(fqn)

        return by_fqn, out_edges, in_edges

    def _expand_by_fk_graph(
        self,
        seeds: Set[str],
        out_edges: Dict[str, Set[str]],
        in_edges: Dict[str, Set[str]],
        depth: int,
        cap: int,
    ) -> Dict[str, int]:
        """
        BFS bidirecional no grafo de FK a partir de seeds.

        Retorna:
            Dict fqn -> hop_distance (0 = seed, 1 = vizinho direto, ...). Limitado a `cap` FQNs.
        """
        distances: Dict[str, int] = {fqn: 0 for fqn in seeds}
        if depth <= 0 or not seeds:
            return distances

        frontier: deque[Tuple[str, int]] = deque((fqn, 0) for fqn in seeds)
        while frontier:
            current, dist = frontier.popleft()
            if dist >= depth:
                continue
            neighbors = out_edges.get(current, set()) | in_edges.get(current, set())
            for nb in neighbors:
                if nb in distances:
                    continue
                distances[nb] = dist + 1
                if len(distances) >= cap:
                    logger.info(
                        "Expansão FK atingiu cap %d (depth atual=%d). Truncando.",
                        cap,
                        dist + 1,
                    )
                    return distances
                frontier.append((nb, dist + 1))
        return distances

    def _docs_to_schema_results(
        self,
        chosen: Dict[str, int],
        by_fqn: Dict[str, VectorStoreDocument],
        seed_scores: Dict[str, float],
    ) -> List[SchemaResult]:
        """
        Agrupa as tabelas selecionadas por database_id em SchemaResult.

        Mantém o shape esperado pelo backend NestJS: schema = {tables: [{name, columns, foreign_keys}, ...]}.
        relevance_score do grupo = max score entre suas tabelas (seed=score real, expandida=decaimento por hop).
        """
        groups: Dict[str, Dict[str, Any]] = {}

        for fqn, hop in chosen.items():
            doc = by_fqn.get(fqn)
            if doc is None:
                continue
            meta = self._parse_metadata(doc.metadata)
            db_id = meta.get("database_id") or fqn.split(".")[0]
            db_name = meta.get("database_name")
            schema_name = meta.get("schema_name")
            table_name = meta.get("table_name") or fqn.split(".")[-1]
            qualified_name = f"{schema_name}.{table_name}" if schema_name else table_name

            score = seed_scores.get(fqn)
            if score is None:
                # Tabela expandida: decai com hop (hop>=1).
                score = max(0.0, 0.8 / (hop + 1))

            group = groups.setdefault(
                db_id,
                {
                    "database_id": db_id,
                    "database_name": db_name,
                    "tables": [],
                    "max_score": 0.0,
                },
            )
            group["tables"].append(
                {
                    "name": qualified_name,
                    "description": meta.get("description"),
                    "columns": meta.get("columns", []),
                    "foreign_keys": meta.get("foreign_keys", []),
                    "_score": score,
                    "_hop": hop,
                }
            )
            if score > group["max_score"]:
                group["max_score"] = score

        ordered_groups = sorted(
            groups.values(), key=lambda g: g["max_score"], reverse=True
        )

        results: List[SchemaResult] = []
        for rank, group in enumerate(ordered_groups, start=1):
            tables_sorted = sorted(
                group["tables"], key=lambda t: t["_score"], reverse=True
            )
            results.append(
                SchemaResult(
                    database_id=group["database_id"],
                    database_name=group["database_name"],
                    schema={"tables": tables_sorted},
                    relevance_score=min(1.0, max(0.0, group["max_score"])),
                    rank=rank,
                )
            )
        return results

    async def _retrieve_table_seeds(
        self, natural_language_query: str, top_k: int
    ) -> List[Tuple[str, float]]:
        """Top-K tabelas por similaridade. Retorna [(fqn, score), ...]."""
        request = VectorStoreSearchRequest(
            query=natural_language_query,
            collection=self.settings.schema_tables_collection,
            top_k=top_k,
            min_score=self.settings.min_table_similarity_score,
        )
        try:
            response = await self.vector_store_client.search(request)
        except Exception as e:
            logger.exception(
                "Falha na busca por similaridade em %s: %s",
                self.settings.schema_tables_collection,
                e,
            )
            return []

        seeds: List[Tuple[str, float]] = []
        for r in response.results:
            meta = self._parse_metadata(r.document.metadata)
            fqn = meta.get("fqn") or r.id
            if fqn:
                seeds.append((fqn, r.score))
        return seeds

    async def _load_all_table_docs(self) -> List[VectorStoreDocument]:
        cap = max(1, min(self.settings.schema_catalog_max_fetch, 1000))
        try:
            return await self.vector_store_client.list_documents(
                self.settings.schema_tables_collection, max_fetch=cap
            )
        except Exception as e:
            logger.exception("Falha ao listar tabelas da coleção schema_tables: %s", e)
            return []

    async def get_context(self, request: ContextRequest) -> ContextResponse:
        """
        Fluxo:
            1. Embed query (via wrapper).
            2. Em paralelo: (a) top-K tabelas por similaridade, (b) listar todas tabelas para grafo, (c) buscar queries similares.
            3. BFS bidirecional no grafo de FK até depth N (default settings.fk_expansion_depth).
            4. Agrupar tabelas selecionadas por database_id e retornar SchemaResult.
        """
        start_time = time.time()

        max_results = min(
            request.max_results or self.settings.default_max_results,
            self.settings.max_max_results,
        )
        min_score = (
            request.min_relevance_score
            if request.min_relevance_score is not None
            else self.settings.default_min_relevance_score
        )
        depth = (
            request.fk_expansion_depth
            if request.fk_expansion_depth is not None
            else self.settings.fk_expansion_depth
        )

        query_request = VectorStoreSearchRequest(
            query=request.natural_language_query,
            collection=self.settings.query_collection,
            top_k=max_results,
            min_score=min_score,
        )

        seeds_task = self._retrieve_table_seeds(
            request.natural_language_query, self.settings.top_k_tables
        )
        all_tables_task = self._load_all_table_docs()
        queries_task = self.vector_store_client.search(query_request)

        seeds, all_table_docs, query_response = await asyncio.gather(
            seeds_task, all_tables_task, queries_task
        )

        seed_scores: Dict[str, float] = {fqn: score for fqn, score in seeds}
        by_fqn, out_edges, in_edges = self._build_graph(all_table_docs)

        valid_seeds: Set[str] = {fqn for fqn in seed_scores.keys() if fqn in by_fqn}
        chosen = self._expand_by_fk_graph(
            seeds=valid_seeds,
            out_edges=out_edges,
            in_edges=in_edges,
            depth=depth,
            cap=self.settings.max_tables_after_expansion,
        )

        schema_results = self._docs_to_schema_results(chosen, by_fqn, seed_scores)

        query_results: List[QueryResult] = []
        for rank, result in enumerate(query_response.results, start=1):
            metadata = result.document.metadata
            query_results.append(
                QueryResult(
                    id=result.id,
                    natural_language_query=metadata.get(
                        "natural_language_query", result.document.content
                    ),
                    sql_query=metadata.get("sql_query", ""),
                    similarity=result.score,
                    rank=rank,
                    validated_at=metadata.get("validated_at"),
                )
            )

        search_time_ms = (time.time() - start_time) * 1000
        logger.info(
            "Context: seeds=%d, expanded=%d, depth=%d, time=%.1fms",
            len(valid_seeds),
            len(chosen),
            depth,
            search_time_ms,
        )

        return ContextResponse(
            schemas=schema_results,
            queries=query_results,
            metadata=ContextResponseMetadata(
                total_schemas_found=len(schema_results),
                total_queries_found=query_response.total,
                limit_applied=max_results,
                search_time_ms=search_time_ms,
            ),
        )
