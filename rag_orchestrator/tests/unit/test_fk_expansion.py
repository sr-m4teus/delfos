"""Unit tests para expansão BFS no grafo de FK (ContextService)."""

import pytest

from src.api.models.context_request import ContextRequest
from src.api.models.database_schema import DatabaseSchemaInput
from src.config.settings import Settings
from src.services.context_service import ContextService
from src.services.mock_vector_store_client import MockVectorStoreClient
from src.services.schema_service import SchemaService


def _build_settings() -> Settings:
    return Settings(
        vector_store_url="mock",
        schema_collection="database_schemas",
        schema_tables_collection="schema_tables",
        query_collection="validated_queries",
        fk_expansion_depth=2,
        top_k_tables=5,
        max_tables_after_expansion=50,
        min_table_similarity_score=0.5,
    )


def _chain_schema() -> DatabaseSchemaInput:
    """
    Schema com 3 tabelas em cadeia A -> B -> C (FKs forward).

    A.bid referencia B.id
    B.cid referencia C.id
    """
    return DatabaseSchemaInput(
        database_id="db1",
        database_name="db1",
        schema={
            "tables": [
                {
                    "name": "public.alpha_unique_word",
                    "columns": [
                        {"name": "id", "type": "int"},
                        {"name": "bid", "type": "int"},
                    ],
                    "foreign_keys": [
                        {
                            "column": "bid",
                            "ref_database_id": "db1",
                            "ref_schema": "public",
                            "ref_table": "beta_table",
                            "ref_column": "id",
                        }
                    ],
                },
                {
                    "name": "public.beta_table",
                    "columns": [
                        {"name": "id", "type": "int"},
                        {"name": "cid", "type": "int"},
                    ],
                    "foreign_keys": [
                        {
                            "column": "cid",
                            "ref_database_id": "db1",
                            "ref_schema": "public",
                            "ref_table": "gamma_table",
                            "ref_column": "id",
                        }
                    ],
                },
                {
                    "name": "public.gamma_table",
                    "columns": [{"name": "id", "type": "int"}],
                    "foreign_keys": [],
                },
            ]
        },
        version="1.0",
        metadata={},
    )


async def _register_and_get_context(depth: int, query: str = "bid") -> set[str]:
    """Helper: registra schema chain, busca contexto, retorna conjunto de FQNs no resultado.

    Query default 'bid' bate apenas na coluna FK exclusiva da tabela A no MockVectorStoreClient
    (mock usa word overlap por split em whitespace).
    """
    settings = _build_settings()
    client = MockVectorStoreClient()
    schema_service = SchemaService(client, settings)
    await schema_service.register_schema(_chain_schema())

    context_service = ContextService(client, settings)
    response = await context_service.get_context(
        ContextRequest(
            natural_language_query=query,
            max_results=10,
            min_relevance_score=0.0,
            fk_expansion_depth=depth,
        )
    )
    fqns: set[str] = set()
    for schema in response.schemas:
        for table in schema.schema.get("tables", []):
            fqns.add(f"{schema.database_id}.{table['name']}")
    return fqns


@pytest.mark.unit
class TestFkExpansion:
    @pytest.mark.asyncio
    async def test_depth_zero_returns_only_seed(self) -> None:
        fqns = await _register_and_get_context(depth=0)
        assert fqns == {"db1.public.alpha_unique_word"}

    @pytest.mark.asyncio
    async def test_depth_one_includes_direct_neighbor(self) -> None:
        fqns = await _register_and_get_context(depth=1)
        assert fqns == {
            "db1.public.alpha_unique_word",
            "db1.public.beta_table",
        }

    @pytest.mark.asyncio
    async def test_depth_two_reaches_transitive_neighbor(self) -> None:
        fqns = await _register_and_get_context(depth=2)
        assert fqns == {
            "db1.public.alpha_unique_word",
            "db1.public.beta_table",
            "db1.public.gamma_table",
        }

    @pytest.mark.asyncio
    async def test_reverse_fk_is_traversed(self) -> None:
        """Seed em C (folha) deve alcançar B via in_edges (reverse FK).

        Query 'cid->db1.public.gamma_table.id' é token único no content de B,
        que tem FK->gamma. BFS depth=1 a partir de B alcança gamma (out) e alpha (in).
        Aqui testamos especificamente que alcança gamma forward e... reverse vamos
        usar seed em gamma diretamente: token único 'db1.public.gamma_table:'.
        """
        settings = _build_settings()
        client = MockVectorStoreClient()
        schema_service = SchemaService(client, settings)
        await schema_service.register_schema(_chain_schema())

        context_service = ContextService(client, settings)
        response = await context_service.get_context(
            ContextRequest(
                natural_language_query="db1.public.gamma_table:",
                max_results=10,
                min_relevance_score=0.0,
                fk_expansion_depth=1,
            )
        )
        fqns: set[str] = set()
        for schema in response.schemas:
            for table in schema.schema.get("tables", []):
                fqns.add(f"{schema.database_id}.{table['name']}")
        assert "db1.public.gamma_table" in fqns
        # gamma é folha sem FK forward; só pode ter chegado a beta via reverse FK
        assert "db1.public.beta_table" in fqns

    @pytest.mark.asyncio
    async def test_expansion_respects_cap(self) -> None:
        """max_tables_after_expansion limita o total retornado."""
        settings = _build_settings()
        settings.max_tables_after_expansion = 2
        client = MockVectorStoreClient()
        schema_service = SchemaService(client, settings)
        await schema_service.register_schema(_chain_schema())

        context_service = ContextService(client, settings)
        response = await context_service.get_context(
            ContextRequest(
                natural_language_query="bid",
                max_results=10,
                min_relevance_score=0.0,
                fk_expansion_depth=5,
            )
        )
        total_tables = sum(
            len(s.schema.get("tables", [])) for s in response.schemas
        )
        assert total_tables <= 2
