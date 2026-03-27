#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export LOCAL_UID="${LOCAL_UID:-$(id -u)}"
export LOCAL_GID="${LOCAL_GID:-$(id -g)}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "docker compose is required"
  exit 1
fi

MODE="${1:-}"
ACTION="${2:-up}"

if [[ -z "$MODE" ]]; then
  echo "usage: scripts/app.sh <dev|prod> [up|down|build|logs|ps|restart]"
  exit 1
fi

case "$MODE" in
  dev)
    SERVICE="app-dev"
    PROFILE="dev"
    ;;
  prod)
    SERVICE="app"
    PROFILE="prod"
    ;;
  *)
    echo "invalid mode: $MODE"
    echo "usage: scripts/app.sh <dev|prod> [up|down|build|logs|ps|restart]"
    exit 1
    ;;
esac

case "$ACTION" in
  up)
    exec "${COMPOSE_CMD[@]}" --profile "$PROFILE" up --build "$SERVICE"
    ;;
  down)
    exec "${COMPOSE_CMD[@]}" --profile "$PROFILE" down
    ;;
  build)
    exec "${COMPOSE_CMD[@]}" --profile "$PROFILE" build "$SERVICE"
    ;;
  logs)
    exec "${COMPOSE_CMD[@]}" --profile "$PROFILE" logs -f "$SERVICE"
    ;;
  ps)
    exec "${COMPOSE_CMD[@]}" --profile "$PROFILE" ps
    ;;
  restart)
    exec "${COMPOSE_CMD[@]}" --profile "$PROFILE" restart "$SERVICE"
    ;;
  *)
    echo "invalid action: $ACTION"
    echo "usage: scripts/app.sh <dev|prod> [up|down|build|logs|ps|restart]"
    exit 1
    ;;
esac
