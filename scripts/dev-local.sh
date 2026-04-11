#!/usr/bin/env bash
# Proteinify — reliable local dev: IPv4 bind + clean port + deps check
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Proteinify dev (directory: $ROOT)"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed or not in PATH."
  echo "Install from https://nodejs.org (LTS), then open a NEW terminal and run this script again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found. Reinstall Node.js LTS from https://nodejs.org"
  exit 1
fi

echo "==> node $(node -v) | npm $(npm -v)"

# Optional: set SKIP_PORT_KILL=1 to leave whatever is on :3000 alone
if [[ "${SKIP_PORT_KILL:-}" != "1" ]]; then
  if lsof -ti :3000 >/dev/null 2>&1; then
    echo "==> Port 3000 is busy — stopping listener(s) so Next can bind..."
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi

echo "==> Installing deps (safe if already installed)..."
npm install

echo "==> Starting Next.js on http://127.0.0.1:3000"
echo ""
echo "    IMPORTANT: Leave THIS terminal window open. If you close it or press Ctrl+C,"
echo "    the server stops and curl/browser will show 'connection refused'."
echo ""
echo "    Wait until you see:  ✓ Ready"
echo "    Then open http://127.0.0.1:3000 in a browser, or run curl from a *second* terminal:"
echo "      curl -I http://127.0.0.1:3000"
echo ""

exec npx next dev --hostname 127.0.0.1 --port 3000
