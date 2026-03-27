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

wait_for_http() {
  local url="$1"
  local retries="${2:-20}"
  local delay_seconds="${3:-2}"

  for ((attempt = 1; attempt <= retries; attempt++)); do
    if curl -fsS "${url}" >/dev/null; then
      return 0
    fi
    sleep "${delay_seconds}"
  done

  return 1
}

echo "[INFO] Running health checks..."
if wait_for_http "http://127.0.0.1:8000/health" 30 2; then
  echo "[OK] API health check passed"
else
  echo "[ERROR] API health check failed: http://127.0.0.1:8000/health"
  exit 1
fi

if wait_for_http "http://127.0.0.1:3000${NEXT_PUBLIC_BASE_PATH:-}/" 30 2; then
  echo "[OK] WEB health check passed"
else
  echo "[ERROR] WEB health check failed: http://127.0.0.1:3000${NEXT_PUBLIC_BASE_PATH:-}/"
  exit 1
fi

echo "[INFO] Service status:"
docker compose "${COMPOSE_ARGS[@]}" ps
