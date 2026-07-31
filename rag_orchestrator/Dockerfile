FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/hf \
    TRANSFORMERS_OFFLINE=0

WORKDIR /app

# CPU-only torch primeiro (evita baixar build CUDA ~2GB via sentence-transformers)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake do modelo de embedding no build -> sem download em runtime (sem cold-start lento)
ARG EMBEDDING_MODEL_NAME=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${EMBEDDING_MODEL_NAME}')"
# A partir daqui roda offline (modelo já em cache)
ENV TRANSFORMERS_OFFLINE=1 \
    HF_HUB_OFFLINE=1
# HF Spaces roda runtime como user 1000: cache precisa ser legível
RUN chmod -R a+rX /app/.cache

COPY src/ ./src/

# HF Spaces espera a app na porta 7860
EXPOSE 7860

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "7860"]
