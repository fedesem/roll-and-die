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
NPM_ARGS=("${@:3}")

if [[ -z "$MODE" ]]; then
  echo "usage: scripts/app.sh <dev|prod> [up|down|build|logs|ps|restart|npm]"
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
    echo "usage: scripts/app.sh <dev|prod> [up|down|build|logs|ps|restart|npm]"
    exit 1
    ;;
esac

run_dev_npm() {
  if [[ "$MODE" != "dev" ]]; then
    echo "npm is only supported for dev mode"
    exit 1
  fi

  if [[ ${#NPM_ARGS[@]} -eq 0 ]]; then
    NPM_ARGS=(install)
  fi

  exec "${COMPOSE_CMD[@]}" --profile "$PROFILE" run --rm --no-deps "$SERVICE" npm "${NPM_ARGS[@]}"
}

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
  npm)
    run_dev_npm
    ;;
  *)
    echo "invalid action: $ACTION"
    echo "usage: scripts/app.sh <dev|prod> [up|down|build|logs|ps|restart|npm]"
    exit 1
    ;;
esac
