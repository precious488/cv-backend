#!/usr/bin/env bash
# scripts/health-check.sh
# Checks the health of all running services.

SERVICES=(
  "auth-service|http://localhost:3001/health"
  "profile-service|http://localhost:3002/health"
  "cv-service|http://localhost:3003/health"
  "document-service|http://localhost:3004/health"
  "ats-service|http://localhost:3005/health"
  "ai-service|http://localhost:3006/health"
  "api-gateway|http://localhost:4000/health"
)

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║          craft-your-career health            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

ALL_OK=true

for entry in "${SERVICES[@]}"; do
  name=$(echo "$entry" | cut -d'|' -f1)
  url=$(echo "$entry" | cut -d'|' -f2)

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null)

  if [ "$STATUS" == "200" ]; then
    echo "  ✅  $name"
  else
    echo "  ❌  $name (HTTP $STATUS)"
    ALL_OK=false
  fi
done

echo ""
if $ALL_OK; then
  echo "All services are healthy ✓"
else
  echo "Some services are unhealthy. Check logs/ for details."
fi
echo ""
