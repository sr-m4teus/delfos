"""Embedding service interface and implementation for vectorizing text."""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import List

from src.config.settings import Settings

logger = logging.getLogger(__name__)


class EmbeddingService(ABC):
    """Interface para serviço de embeddings (mesmo modelo para insert e search)."""

    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        """
        Gera o vetor de embedding para um texto.

        Args:
            text: Texto a vetorizar.

        Returns:
            Lista de floats representando o vetor.

        Raises:
            ValueError: Se text for inválido ou o modelo falhar.
        """
        pass


class SentenceTransformerEmbeddingService(EmbeddingService):
    """
    Implementação usando sentence-transformers (modelo local).

    O mesmo modelo é usado para insert e search; carregado no construtor.
    Texto vazio é passado ao modelo (comportamento definido pela biblioteca).
    """

    def __init__(self, settings: Settings) -> None:
        self._model_name = settings.embedding_model_name
        self._device = settings.embedding_device
        self._model = None

    def _get_model(self):
        """Lazy load do modelo (evita carregar em testes quando não usado)."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                logger.info("Carregando modelo de embedding: %s", self._model_name)
                self._model = SentenceTransformer(
                    self._model_name, device=self._device
                )
            except Exception as e:
                logger.exception("Falha ao carregar modelo de embedding: %s", e)
                raise RuntimeError(
                    f"Não foi possível carregar o modelo de embedding '{self._model_name}'. "
                    "Verifique EMBEDDING_MODEL_NAME e dependências (sentence-transformers)."
                ) from e
        return self._model

    def _encode_sync(self, text: str) -> List[float]:
        """Executa encode no thread atual (bloqueante)."""
        model = self._get_model()
        if not text.strip():
            logger.warning("Texto vazio passado ao embedding; retornando vetor do modelo para string vazia.")
        vector = model.encode(text, convert_to_numpy=True)
        return vector.tolist()

    async def embed(self, text: str) -> List[float]:
        """Gera embedding de forma assíncrona (executa encode em thread separada)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._encode_sync, text)
