"""Testes: score de similaridade a partir da distância Weaviate (evita falso 1.0)."""

from types import SimpleNamespace

import pytest

from src.services.weaviate_similarity import (
    extract_distance_from_metadata,
    similarity_score_from_weaviate_distance,
)


@pytest.mark.unit
class TestSimilarityScoreFromWeaviateDistance:
    def test_none_distance_never_assumes_perfect_match(self) -> None:
        """Sem distância válida não se deve retornar 1.0 (causava falso modo substituição)."""
        assert similarity_score_from_weaviate_distance(None) == 0.0

    def test_zero_distance_is_perfect(self) -> None:
        assert similarity_score_from_weaviate_distance(0.0) == 1.0

    def test_small_distance_high_score(self) -> None:
        assert similarity_score_from_weaviate_distance(0.001) == pytest.approx(0.999)

    def test_large_distance_clamped_to_zero(self) -> None:
        assert similarity_score_from_weaviate_distance(2.0) == 0.0


@pytest.mark.unit
class TestExtractDistanceFromMetadata:
    def test_raw_float(self) -> None:
        meta = SimpleNamespace(distance=0.05)
        assert extract_distance_from_metadata(meta) == 0.05

    def test_object_with_value(self) -> None:
        meta = SimpleNamespace(distance=SimpleNamespace(value=0.1))
        assert extract_distance_from_metadata(meta) == 0.1

    def test_missing_distance(self) -> None:
        meta = SimpleNamespace()
        assert extract_distance_from_metadata(meta) is None

    def test_none_metadata(self) -> None:
        assert extract_distance_from_metadata(None) is None
