#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="deploy/host/docker-compose.prod.yml"
ENV_FILE="deploy/host/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from deploy/host.example/.env.production.example and set secrets." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ "${POSTGRES_PASSWORD:-}" == "" || "${POSTGRES_PASSWORD}" == change-me* ]]; then
  echo "Set a strong POSTGRES_PASSWORD in $ENV_FILE before deploying." >&2
  exit 1
fi

echo "Building and starting traceforge-prod..."
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d --build

echo "Waiting for API on 127.0.0.1:14080..."
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:14080/health" >/dev/null 2>&1; then
    echo "API healthy."
    break
  fi
  sleep 2
done

if ! curl -sf "http://127.0.0.1:14080/health" >/dev/null 2>&1; then
  echo "API not healthy — logs: docker compose -f $COMPOSE logs api" >&2
  exit 1
fi

echo ""
echo "Stack is up on loopback:"
echo "  Web  http://127.0.0.1:13080"
echo "  API  http://127.0.0.1:14080"
echo ""
echo "Next: add deploy/host/Caddyfile to your host Caddy and reload (see deploy/README.md)."
