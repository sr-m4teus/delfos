"""Conversão de distância Weaviate → score de similaridade [0, 1]."""

from typing import Any, Optional


def extract_distance_from_metadata(metadata: Any) -> Optional[float]:
    """
    Lê distance do objeto metadata retornado pelo cliente Weaviate v4.
    Pode vir como float direto ou como objeto com .value.
    """
    if metadata is None:
        return None
    raw = getattr(metadata, "distance", None)
    if raw is None:
        return None
    if hasattr(raw, "value"):
        v = raw.value
        if v is None:
            return None
        return float(v)
    return float(raw)


def similarity_score_from_weaviate_distance(distance: Optional[float]) -> float:
    """
    Converte distância em score tipo similaridade.

    - distance=None: retorna 0.0 (nunca assumir match perfeito sem medida válida).
    - distância 0: vetores idênticos → 1.0
    - Caso contrário: max(0, min(1, 1 - d)) para d típico em [0, 2] em métricas coseno.
    """
    if distance is None:
        return 0.0
    d = float(distance)
    return max(0.0, min(1.0, 1.0 - d))
