#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_ARGS=(
  --env-file .env
  -f docker-compose.yml
  -f deploy/docker-compose.prod.yml
)

if [[ ! -f .env ]]; then
  echo "[ERROR] .env not found in $ROOT_DIR"
  echo "Copy deploy/env/.env.prod.example to .env and fill values."
  exit 1
fi

set -a
source .env
set +a

if [[ -z "${GOOGLE_CREDENTIALS_FILE:-}" ]]; then
  echo "[ERROR] GOOGLE_CREDENTIALS_FILE is not set in .env"
  exit 1
fi

if [[ ! -f "${GOOGLE_CREDENTIALS_FILE}" ]]; then
  echo "[ERROR] GOOGLE_CREDENTIALS_FILE points to missing file: ${GOOGLE_CREDENTIALS_FILE}"
  exit 1
fi

echo "[INFO] Building and starting containers..."
docker compose "${COMPOSE_ARGS[@]}" up -d --build

echo "[INFO] Running health checks..."
curl -fsS http://127.0.0.1:8000/health >/dev/null
echo "[OK] API health check passed"

echo "[INFO] Service status:"
docker compose "${COMPOSE_ARGS[@]}" ps
