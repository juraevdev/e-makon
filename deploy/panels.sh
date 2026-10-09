#!/usr/bin/env bash
# Build SuperAdmin + firma admin Next.js panels and (re)start them under pm2.
#   API_BASE_URL=https://api.e-makon.uz/api/v1 bash deploy/panels.sh
# Panels listen on PANEL_HOST (default 127.0.0.1) behind deploy/host-nginx/e-makon.conf.
# NEXT_PUBLIC_* values are baked in at build time, so rerun after changing them.
set -euo pipefail

: "${API_BASE_URL:?API_BASE_URL is required, e.g. https://api.e-makon.uz/api/v1}"
SUPERADMIN_PORT="${SUPERADMIN_PORT:-8111}"
ADMIN_PORT="${ADMIN_PORT:-8112}"
PANEL_HOST="${PANEL_HOST:-127.0.0.1}"
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
  pm2 start node_modules/next/dist/bin/next --name "$name" -- start -H "$PANEL_HOST" -p "$port"
}

deploy_panel superadmin_panel emakon-superadmin "$SUPERADMIN_PORT"
deploy_panel admin_panel emakon-admin "$ADMIN_PORT"
pm2 save
echo PANELS_DONE
