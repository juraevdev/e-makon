#!/usr/bin/env bash
# Build SuperAdmin + firma admin Next.js panels and (re)start them under pm2.
#   API_BASE_URL=http://HOST:8110/api/v1 bash deploy/panels.sh
# NEXT_PUBLIC_* values are baked in at build time, so rerun after changing them.
set -euo pipefail

: "${API_BASE_URL:?API_BASE_URL is required, e.g. http://HOST:8110/api/v1}"
SUPERADMIN_PORT="${SUPERADMIN_PORT:-8111}"
ADMIN_PORT="${ADMIN_PORT:-8112}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL"
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"

deploy_panel() {
  local dir=$1 name=$2 port=$3
  echo "=== $dir -> :$port ==="
  cd "$ROOT/$dir"
  npm ci --no-audit --no-fund
  npx next build
  pm2 delete "$name" >/dev/null 2>&1 || true
  pm2 start node_modules/next/dist/bin/next --name "$name" -- start -H 0.0.0.0 -p "$port"
}

deploy_panel superadmin_panel emakon-superadmin "$SUPERADMIN_PORT"
deploy_panel admin_panel emakon-admin "$ADMIN_PORT"
pm2 save
echo PANELS_DONE
