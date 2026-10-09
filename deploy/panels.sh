#!/usr/bin/env bash
# Build SuperAdmin + firma admin Next.js panels and (re)start them under pm2.
#   SUPERADMIN_API_BASE_URL=https://superadmin.e-makon.uz/api/v1 \
#   ADMIN_API_BASE_URL=https://admin.e-makon.uz/api/v1 bash deploy/panels.sh
# (or a single API_BASE_URL for both). Panels listen on PANEL_HOST (default 127.0.0.1)
# behind deploy/host-nginx/e-makon.conf, which proxies /api/ on each panel domain to the API.
# NEXT_PUBLIC_* values are baked in at build time, so rerun after changing them.
set -euo pipefail

SUPERADMIN_API_BASE_URL="${SUPERADMIN_API_BASE_URL:-${API_BASE_URL:-}}"
ADMIN_API_BASE_URL="${ADMIN_API_BASE_URL:-${API_BASE_URL:-}}"
: "${SUPERADMIN_API_BASE_URL:?set SUPERADMIN_API_BASE_URL or API_BASE_URL}"
: "${ADMIN_API_BASE_URL:?set ADMIN_API_BASE_URL or API_BASE_URL}"
SUPERADMIN_PORT="${SUPERADMIN_PORT:-8111}"
ADMIN_PORT="${ADMIN_PORT:-8112}"
PANEL_HOST="${PANEL_HOST:-127.0.0.1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"

deploy_panel() {
  local dir=$1 name=$2 port=$3 api=$4
  echo "=== $dir -> :$port (API $api) ==="
  cd "$ROOT/$dir"
  npm ci --no-audit --no-fund
  NEXT_PUBLIC_API_BASE_URL="$api" npx next build
  pm2 delete "$name" >/dev/null 2>&1 || true
  pm2 start node_modules/next/dist/bin/next --name "$name" -- start -H "$PANEL_HOST" -p "$port"
}

deploy_panel superadmin_panel emakon-superadmin "$SUPERADMIN_PORT" "$SUPERADMIN_API_BASE_URL"
deploy_panel admin_panel emakon-admin "$ADMIN_PORT" "$ADMIN_API_BASE_URL"
pm2 save
echo PANELS_DONE
