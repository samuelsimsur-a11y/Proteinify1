#!/usr/bin/env bash
# If `next dev` misbehaves, use production server (must build first).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command -v node >/dev/null 2>&1 || { echo "Install Node.js first."; exit 1; }

if lsof -ti :3000 >/dev/null 2>&1; then
  echo "Stopping process on :3000..."
  lsof -ti :3000 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

npm install
npm run build
echo "==> Production server: http://127.0.0.1:3000 (leave this terminal open)"
exec npm run start:local
