#!/usr/bin/env bash
# Uso: ./deploy.sh backend [--db] | frontend | all [--db]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER=hetzner
[ -f "$ROOT/backend/package.json" ] && [ -f "$ROOT/frontend/package.json" ] \
  || { echo "❌ No encuentro backend/ y frontend/ junto a deploy.sh"; exit 1; }

deploy_backend() {
  echo "🚀 Backend desde $ROOT/backend"
  find "$ROOT/backend/src" "$ROOT/backend/scripts" -name '*.js' -print0 | xargs -0 -n1 node --check
  rsync -az --exclude node_modules --exclude '.env*' --exclude '*.log' --exclude logs --exclude uploads \
    "$ROOT/backend/" "$SERVER:/home/sebs/gastos-app/backend/"
  local DB=""
  [ "${1:-}" = "--db" ] && DB="~/backup-db.sh && npx prisma db push --accept-data-loss && npx prisma generate &&"
  ssh "$SERVER" "cd ~/gastos-app/backend && $DB pm2 restart gastos-backend >/dev/null && sleep 3 && pm2 logs gastos-backend --err --lines 5 --nostream"
  echo "✅ Backend desplegado"
}

deploy_frontend() {
  echo "🚀 Frontend desde $ROOT/frontend"
  (cd "$ROOT/frontend" && npx tsc --noEmit && npm run build)
  rsync -az --delete "$ROOT/frontend/dist/" "$SERVER:/var/www/gastos-frontend/"
  echo "✅ Frontend desplegado"
}

case "${1:-}" in
  backend)  deploy_backend "${2:-}" ;;
  frontend) deploy_frontend ;;
  all)      deploy_backend "${2:-}"; deploy_frontend ;;
  *) echo "Uso: ./deploy.sh backend [--db] | frontend | all [--db]"; exit 1 ;;
esac
