"""Database schema models for API."""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime


class ForeignKeyRef(BaseModel):
    """Referência de chave estrangeira para outra tabela."""

    column: str = Field(..., description="Coluna da tabela atual que referencia")
    ref_database_id: str = Field(..., description="Catálogo da tabela referenciada")
    ref_schema: Optional[str] = Field(None, description="Schema da tabela referenciada")
    ref_table: str = Field(..., description="Nome da tabela referenciada")
    ref_column: str = Field(..., description="Coluna da tabela referenciada")


class TableColumn(BaseModel):
    """Coluna de uma tabela."""

    name: str = Field(..., description="Nome da coluna")
    type: str = Field(..., description="Tipo da coluna")


class TableSchemaInput(BaseModel):
    """Tabela individual dentro de um schema de banco."""

    name: str = Field(..., description="Nome da tabela (pode incluir schema: 'schema.table')")
    description: Optional[str] = Field(
        None, description="Descrição de negócio da tabela (glossário), usada para enriquecer o embedding"
    )
    columns: List[TableColumn] = Field(default_factory=list, description="Colunas da tabela")
    foreign_keys: List[ForeignKeyRef] = Field(
        default_factory=list, description="Chaves estrangeiras desta tabela"
    )


class DatabaseSchemaInput(BaseModel):
    """Input para registro de schema de banco de dados."""

    database_id: str = Field(
        ..., description="Identificador único do banco de dados", min_length=1
    )
    database_name: Optional[str] = Field(None, description="Nome do banco de dados")
    schema: Dict[str, Any] = Field(
        ...,
        description="Schema completo. Esperado: {'tables': [{name, columns, foreign_keys}, ...]}",
    )
    version: Optional[str] = Field(None, description="Versão do schema")
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Metadados adicionais"
    )


class DatabaseSchemaResponse(BaseModel):
    """Resposta após registro de schema."""

    database_id: str = Field(..., description="Identificador do banco de dados")
    registered_at: datetime = Field(..., description="Timestamp de registro")
    version: Optional[str] = Field(None, description="Versão do schema")
    success: bool = Field(..., description="Indica se o registro foi bem-sucedido")
    tables_indexed: int = Field(
        default=0, description="Número de tabelas indexadas individualmente no vector store"
    )
