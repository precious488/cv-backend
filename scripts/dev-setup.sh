#!/usr/bin/env bash
# scripts/dev-setup.sh
# Run this once to install all dependencies across every service.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   craft-your-career — backend dev setup      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Copy env if not present
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✔  Created .env from .env.example — fill in your secrets before starting"
else
  echo "✔  .env already exists"
fi

SERVICES=(
  "shared"
  "services/auth-service"
  "services/user-profile-service"
  "services/cv-service"
  "services/document-service"
  "services/ats-service"
  "services/ai-service"
  "api-gateway"
)

for svc in "${SERVICES[@]}"; do
  echo ""
  echo "── Installing: $svc"
  (cd "$ROOT/$svc" && npm install)
  echo "   ✔ Done"
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   All dependencies installed!                ║"
echo "║                                              ║"
echo "║   Next steps:                                ║"
echo "║   1. Edit .env with your secrets             ║"
echo "║   2. docker compose up -d                    ║"
echo "║      (starts MongoDB, Redis, RabbitMQ)       ║"
echo "║   3. npm run dev   (in each service)         ║"
echo "║      — or use:  bash scripts/dev-start.sh    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
