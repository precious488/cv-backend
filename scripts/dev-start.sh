#!/usr/bin/env bash
# scripts/dev-start.sh
# Starts all microservices in parallel for local development.
# Requires: tmux (optional) OR runs in background with log files.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Check .env
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Run scripts/dev-setup.sh first."
  exit 1
fi

# Load env
export $(grep -v '^#' .env | xargs)

# Make sure infra is up
echo "Starting infrastructure (MongoDB, Redis, RabbitMQ)..."
docker compose up -d auth-db profile-db cv-db redis rabbitmq
echo "Waiting 5s for services to be ready..."
sleep 5

LOGS_DIR="$ROOT/logs"
mkdir -p "$LOGS_DIR"

declare -A SERVICES
SERVICES["auth-service"]="3001"
SERVICES["user-profile-service"]="3002"
SERVICES["cv-service"]="3003"
SERVICES["document-service"]="3004"
SERVICES["ats-service"]="3005"
SERVICES["ai-service"]="3006"

PIDS=()

start_service() {
  local name=$1
  local port=$2
  local dir=""

  if [ "$name" == "api-gateway" ]; then
    dir="$ROOT/api-gateway"
  else
    dir="$ROOT/services/$name"
  fi

  echo "▶ Starting $name on :$port"
  PORT=$port SERVICE_NAME=$name \
    npx ts-node-dev --respawn --transpile-only "$dir/src/index.ts" \
    > "$LOGS_DIR/$name.log" 2>&1 &
  PIDS+=($!)
}

# Build shared first
echo "Building shared library..."
(cd "$ROOT/shared" && npm run build)

# Start all services
for name in "${!SERVICES[@]}"; do
  start_service "$name" "${SERVICES[$name]}"
done

# Start API gateway last
echo "▶ Starting api-gateway on :4000"
PORT=4000 SERVICE_NAME=api-gateway \
  npx ts-node-dev --respawn --transpile-only "$ROOT/api-gateway/src/index.ts" \
  > "$LOGS_DIR/api-gateway.log" 2>&1 &
PIDS+=($!)

echo ""
echo "All services started. Logs in ./logs/"
echo "API Gateway: http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop all services."

# Trap and kill all on exit
trap 'echo "Stopping all services..."; kill "${PIDS[@]}" 2>/dev/null; docker compose stop auth-db profile-db cv-db redis rabbitmq' EXIT

wait
