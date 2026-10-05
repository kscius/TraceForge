#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.local.yml"
ENV_FILE=".env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.local.example "$ENV_FILE"
  echo "Created $ENV_FILE from .env.local.example"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:14000}"
export API_PUBLIC_URL="${API_PUBLIC_URL:-http://localhost:14000}"
export WEB_PUBLIC_URL="${WEB_PUBLIC_URL:-http://localhost:13000}"

for port in 14000 13000; do
  if command -v ss >/dev/null 2>&1 && ss -tln | grep -q ":${port} "; then
    if ! docker ps --format '{{.Ports}}' 2>/dev/null | grep -q ":${port}->"; then
      echo "Error: port ${port} is in use outside Docker (e.g. old pnpm dev). Stop it, then retry." >&2
      echo "  fuser -k ${port}/tcp   # or find the process with: ss -tlnp | grep :${port}" >&2
      exit 1
    fi
  fi
done

echo "Building and starting TraceForge in Docker (project: traceforge-local)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "Waiting for API health..."
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:14000/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -sf "http://localhost:14000/health" >/dev/null 2>&1; then
  echo "API did not become healthy. Check: docker compose -f $COMPOSE_FILE logs api" >&2
  exit 1
fi

echo ""
echo "TraceForge (Docker, isolated):"
echo "  Web:  ${WEB_PUBLIC_URL}"
echo "  API:  ${API_PUBLIC_URL}/docs"
echo "  DB:   localhost:15432 (traceforge / traceforge)"
echo ""
echo "Stop:  docker compose -f $COMPOSE_FILE down"
echo "Logs:  docker compose -f $COMPOSE_FILE logs -f api web"
