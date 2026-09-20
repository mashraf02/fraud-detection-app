# Fraud Radar API image.
#
# Model artifacts are NOT baked in: they are deployment data that changes on
# retraining, and *.pkl is gitignored. Mount them at /app/model (see
# docker-compose.yml) or set FRAUD_RADAR_MODEL_DIR to wherever they live.
# The service fails fast with a clear message if they are missing.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl is used by the container healthcheck below.
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY pyproject.toml alembic.ini ./
COPY migrations ./migrations
COPY backend ./backend
COPY model/train.py ./model/train.py

# Run as a non-root user.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/model \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Single worker by default; scale with `--workers` or by running more replicas.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
