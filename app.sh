#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT_DIR/example.env" "$ENV_FILE"
  echo "Created $ENV_FILE from example.env"
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

APP_MODE="${APP_MODE:-dev}"
export LOCAL_UID="${LOCAL_UID:-$(id -u)}"
export LOCAL_GID="${LOCAL_GID:-$(id -g)}"

if [[ "$APP_MODE" == "prod" || "$APP_MODE" == "production" ]]; then
  COMPOSE_FILES=("-f" "$ROOT_DIR/compose.yml" "-f" "$ROOT_DIR/compose.prod.yml")
else
  COMPOSE_FILES=("-f" "$ROOT_DIR/compose.yml" "-f" "$ROOT_DIR/compose.dev.yml")
fi

compose() {
  docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" "$@"
}

ensure_traefik_network() {
  local network="${TRAEFIK_NETWORK:-traefik}"
  docker network inspect "$network" >/dev/null 2>&1 || docker network create "$network" >/dev/null
}

npm_in_container() {
  ensure_traefik_network
  compose run --rm --no-deps npm npm "$@"
}

usage() {
  cat <<'EOF'
Usage: ./app.sh <command> [args]

Commands:
  up                 Start the containerized stack
  down               Stop the stack
  restart            Restart the stack
  dul                Stop the stack, start, and follow logs
  du                 Stop the stack and start
  brl                Restart the backend/app service and follow logs
  ps                 Show container status
  logs [service]     Follow container logs
  npm <args>         Run npm inside the development Node container
  npx <args>         Run npx inside the development Node container
  quality            Run the full quality gate (check + knip) in the container
  test               Run unit & integration tests in the container
  test:e2e           Run Playwright E2E tests in the container
  build              Build all workspaces in the container
  lint               Run Biome linter in the container
  format             Run Biome formatter in the container
  knip               Run Knip dead code analysis in the container
  shell              Open an interactive shell in the container
  deploy             Run the production deployment script (deploy.sh)

Set APP_MODE=prod in .env to target production configuration.
EOF
}

cmd="${1:-up}"
if [[ $# -gt 0 ]]; then
  shift
fi

case "$cmd" in
  up | start)
    ensure_traefik_network
    compose up -d --build "$@"
    compose logs -f "$@"
    ;;
  down | stop)
    compose down "$@"
    ;;
  restart)
    ensure_traefik_network
    compose restart "$@"
    compose logs -f "$@"
    ;;
  dul)
    ensure_traefik_network
    compose down
    compose up -d "$@"
    compose logs -f "$@"
    ;;
  du)
    ensure_traefik_network
    compose down
    compose up -d "$@"
    ;;
  brl)
    ensure_traefik_network
    compose restart app
    compose logs -f app
    ;;
  ps)
    compose ps "$@"
    ;;
  logs)
    compose logs -f "$@"
    ;;
  npm)
    npm_in_container "$@"
    ;;
  npx)
    ensure_traefik_network
    compose run --rm --no-deps npm npx "$@"
    ;;
  quality)
    ensure_traefik_network
    compose run --rm --no-deps npm npm run check
    compose run --rm --no-deps npm npm run knip
    ;;
  test)
    ensure_traefik_network
    compose run --rm --no-deps npm npm run test "$@"
    ;;
  test:e2e)
    ensure_traefik_network
    compose run --rm --no-deps npm npx playwright test "$@"
    ;;
  build)
    ensure_traefik_network
    compose run --rm --no-deps npm npm run build
    ;;
  lint)
    ensure_traefik_network
    compose run --rm --no-deps npm npm run lint "$@"
    ;;
  format)
    ensure_traefik_network
    compose run --rm --no-deps npm npm run format "$@"
    ;;
  knip)
    ensure_traefik_network
    compose run --rm --no-deps npm npm run knip
    ;;
  shell)
    ensure_traefik_network
    compose run --rm --no-deps npm sh
    ;;
  deploy)
    "$ROOT_DIR/deploy.sh"
    ;;
  "" | help | -h | --help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
