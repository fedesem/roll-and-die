#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

# Source the environment file to load and export all variables
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Compare keys between .env and example.env
if [[ -f "$ROOT_DIR/example.env" && -f "$ROOT_DIR/.env" ]]; then
  echo "Checking for key differences between example.env and .env..."

  keys_example=$(grep -v '^#' "$ROOT_DIR/example.env" | grep -v '^[[:space:]]*$' | cut -d= -f1 | sort)
  keys_env=$(grep -v '^#' "$ROOT_DIR/.env" | grep -v '^[[:space:]]*$' | cut -d= -f1 | sort)

  missing_in_env=$(comm -23 <(echo "$keys_example") <(echo "$keys_env"))
  missing_in_example=$(comm -13 <(echo "$keys_example") <(echo "$keys_env"))

  has_diff=0
  if [[ -n "$missing_in_env" ]]; then
    echo -e "\033[31m[WARNING] The following keys are defined in example.env but missing in .env:\033[0m"
    echo "$missing_in_env"
    has_diff=1
  fi
  if [[ -n "$missing_in_example" ]]; then
    echo -e "\033[33m[NOTE] The following keys are defined in .env but missing in example.env:\033[0m"
    echo "$missing_in_example"
    has_diff=1
  fi

  if [[ $has_diff -eq 0 ]]; then
    echo "No differences found between .env and example.env keys."
  fi
else
  echo "Missing .env or example.env to perform difference check."
  has_diff=1
fi

if [[ $has_diff -ne 0 ]]; then
  echo ""
  read -r -p "Press ENTER to continue with the deployment, or Ctrl+C to abort..."
fi

# Define docker compose command with environment file and production configuration
COMPOSE_CMD=("docker" "compose" "--env-file" "$ENV_FILE" "-f" "$ROOT_DIR/compose.yml" "-f" "$ROOT_DIR/compose.prod.yml")

# Automate GHCR login if credentials are provided in .env
if [[ -n "${GHCR_TOKEN:-}" && -n "${GHCR_USERNAME:-}" ]]; then
  echo "Logging in to GitHub Container Registry..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

# Ensure external Traefik network exists
TRAEFIK_NETWORK="${TRAEFIK_NETWORK:-traefik}"
docker network inspect "$TRAEFIK_NETWORK" >/dev/null 2>&1 || docker network create "$TRAEFIK_NETWORK" >/dev/null

echo "Pulling production application images..."
"${COMPOSE_CMD[@]}" pull app

echo "Starting production services..."
"${COMPOSE_CMD[@]}" up -d

echo "Deployment completed successfully!"
