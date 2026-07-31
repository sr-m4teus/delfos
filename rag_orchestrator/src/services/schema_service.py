"""Schema service: indexação por tabela com metadados de FK."""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.api.models.database_schema import DatabaseSchemaInput, DatabaseSchemaResponse
from src.services.vector_store_client import (
    VectorStoreClient,
    VectorStoreDocument,
)
from src.config.settings import Settings

logger = logging.getLogger(__name__)


def build_fqn(database_id: str, schema_name: Optional[str], table_name: str) -> str:
    """Constrói FQN canônica: 'database_id.schema.table' ou 'database_id.table' se sem schema."""
    parts = [database_id]
    if schema_name:
        parts.append(schema_name)
    parts.append(table_name)
    return ".".join(parts)


def _split_table_name(raw: str) -> tuple[Optional[str], str]:
    """Aceita 'schema.table' ou apenas 'table'. Retorna (schema, table)."""
    if "." in raw:
        schema, table = raw.split(".", 1)
        return schema, table
    return None, raw


class SchemaService:
    """Indexa schemas com granularidade de tabela: 1 vetor por tabela + FKs no metadata."""

    def __init__(self, vector_store_client: VectorStoreClient, settings: Settings):
        self.vector_store_client = vector_store_client
        self.settings = settings

    def _validate_schema(self, schema_input: DatabaseSchemaInput) -> None:
        if not schema_input.schema:
            raise ValueError("Schema não pode estar vazio")
        if not isinstance(schema_input.schema, dict):
            raise ValueError("Schema deve ser um objeto JSON válido")
        if "tables" not in schema_input.schema:
            raise ValueError(
                "Schema deve conter chave 'tables' (lista). "
                "Granularidade por tabela exige formato {tables: [{name, columns, foreign_keys}, ...]}"
            )
        tables = schema_input.schema.get("tables")
        if not isinstance(tables, list):
            raise ValueError("'tables' deve ser uma lista")

    def _build_table_content(
        self,
        fqn: str,
        columns: List[Dict[str, Any]],
        foreign_keys: List[Dict[str, Any]],
        description: Optional[str] = None,
    ) -> str:
        """Texto sintético usado para gerar o embedding da tabela.

        A descrição de negócio (glossário) vem primeiro: o modelo de embedding é
        treinado em pares de frases em linguagem natural, e discrimina mal texto
        puramente estrutural (tipo DDL) contra perguntas em NL. Ver avaliação de
        contexto na monografia (sec:ameaca-aprendizado-continuo / retrieval).
        """
        col_part = ", ".join(
            f"{c.get('name', '')} ({c.get('type', '')})" for c in columns
        )
        prefix = f"{description} " if description else ""
        text = f"{prefix}{fqn}: {col_part}" if col_part else f"{prefix}{fqn}"
        if foreign_keys:
            fk_part = "; ".join(
                f"{fk.get('column', '')}->{fk.get('ref_fqn', '')}.{fk.get('ref_column', '')}"
                for fk in foreign_keys
            )
            text = f"{text} | FK: {fk_part}"
        return text

    def _normalize_table(
        self,
        database_id: str,
        database_name: Optional[str],
        raw_table: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Normaliza entrada de tabela: extrai schema, computa FQN, normaliza FKs."""
        name_raw = raw_table.get("name", "")
        schema_name, table_name = _split_table_name(name_raw)
        fqn = build_fqn(database_id, schema_name, table_name)

        columns: List[Dict[str, Any]] = []
        for col in raw_table.get("columns", []) or []:
            if isinstance(col, dict):
                columns.append({"name": col.get("name", ""), "type": col.get("type", "")})

        foreign_keys: List[Dict[str, Any]] = []
        for fk in raw_table.get("foreign_keys", []) or []:
            if not isinstance(fk, dict):
                continue
            ref_db = fk.get("ref_database_id", database_id)
            ref_schema = fk.get("ref_schema")
            ref_table = fk.get("ref_table", "")
            ref_fqn = build_fqn(ref_db, ref_schema, ref_table)
            foreign_keys.append(
                {
                    "column": fk.get("column", ""),
                    "ref_database_id": ref_db,
                    "ref_schema": ref_schema,
                    "ref_table": ref_table,
                    "ref_column": fk.get("ref_column", ""),
                    "ref_fqn": ref_fqn,
                }
            )

        return {
            "fqn": fqn,
            "database_id": database_id,
            "database_name": database_name,
            "schema_name": schema_name,
            "table_name": table_name,
            "description": raw_table.get("description"),
            "columns": columns,
            "foreign_keys": foreign_keys,
        }

    def _table_to_document(
        self, normalized: Dict[str, Any], version: Optional[str], extra_meta: Dict[str, Any]
    ) -> VectorStoreDocument:
        fqn = normalized["fqn"]
        content = self._build_table_content(
            fqn,
            normalized["columns"],
            normalized["foreign_keys"],
            normalized.get("description"),
        )
        metadata: Dict[str, Any] = {
            "fqn": fqn,
            "database_id": normalized["database_id"],
            "database_name": normalized["database_name"],
            "schema_name": normalized["schema_name"],
            "table_name": normalized["table_name"],
            "description": normalized.get("description"),
            "columns": normalized["columns"],
            "foreign_keys": normalized["foreign_keys"],
            "version": version,
            "schema_type": "schema_table",
        }
        if extra_meta:
            metadata.update(extra_meta)
        return VectorStoreDocument(id=fqn, content=content, metadata=metadata)

    async def _upsert_document(
        self, collection: str, document: VectorStoreDocument
    ) -> Dict[str, Any]:
        """Tenta insert; se UUID já existe, faz update."""
        try:
            return await self.vector_store_client.insert_document(collection, document)
        except Exception as e:
            msg = str(e).lower()
            if "already exists" in msg or "duplicate" in msg or "conflict" in msg or "409" in msg:
                return await self.vector_store_client.update_document(
                    collection, document.id, document
                )
            raise

    async def register_schema(
        self, schema_input: DatabaseSchemaInput
    ) -> DatabaseSchemaResponse:
        """
        Registra schema com granularidade tabela.

        Cada tabela em schema_input.schema['tables'] vira 1 documento na coleção
        schema_tables_collection. Re-registros sobrescrevem (upsert via UUID determinístico).
        """
        self._validate_schema(schema_input)

        tables_raw = schema_input.schema.get("tables", []) or []
        collection = self.settings.schema_tables_collection

        indexed = 0
        for raw_table in tables_raw:
            if not isinstance(raw_table, dict):
                continue
            normalized = self._normalize_table(
                schema_input.database_id,
                schema_input.database_name,
                raw_table,
            )
            if not normalized["table_name"]:
                logger.warning("Tabela sem nome ignorada em %s", schema_input.database_id)
                continue
            doc = self._table_to_document(
                normalized, schema_input.version, schema_input.metadata or {}
            )
            await self._upsert_document(collection, doc)
            indexed += 1

        logger.info(
            "Schema indexado por tabela: database_id=%s, tables=%d",
            schema_input.database_id,
            indexed,
        )

        return DatabaseSchemaResponse(
            database_id=schema_input.database_id,
            registered_at=datetime.utcnow(),
            version=schema_input.version,
            success=True,
            tables_indexed=indexed,
        )

    async def update_schema(
        self, database_id: str, schema_input: DatabaseSchemaInput
    ) -> DatabaseSchemaResponse:
        """Update == re-register: upsert de cada tabela."""
        if schema_input.database_id != database_id:
            raise ValueError(
                f"database_id no body ({schema_input.database_id}) não corresponde ao path ({database_id})"
            )
        return await self.register_schema(schema_input)
