#!/usr/bin/env bash
# Production deploy: pulls latest code, rebuilds the multi-stage images,
# restarts the stack detached, waits for the API health check, then prunes
# dangling images. Run from the server/ directory.
set -euo pipefail

COMPOSE="sudo docker compose -f docker-compose.yml --env-file .env"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building and starting (detached)"
$COMPOSE up --build -d

echo "==> Waiting for server-api to report healthy"
for i in $(seq 1 30); do
  status="$(sudo docker inspect --format='{{.State.Health.Status}}' server-monitoring-api 2>/dev/null || echo "starting")"
  if [ "$status" = "healthy" ]; then
    echo "server-api is healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "server-api did not become healthy in time (status: $status)" >&2
    $COMPOSE logs --tail=100 server-api
    exit 1
  fi
  sleep 2
done

echo "==> Pruning dangling images"
sudo docker image prune -f

echo "==> Done"
