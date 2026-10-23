#!/usr/bin/env bash
# One-time: copy local Android signing + Play service account into GitHub Actions secrets.
# Usage: npm run android:ci-secrets -- /path/to/play-service-account.json
# Requires the GitHub CLI (`brew install gh`, then `gh auth login`).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"
PROPS="$ANDROID/keystore.properties"
PLAY_JSON="${1:-}"

command -v gh >/dev/null || { echo "Install the GitHub CLI first: brew install gh && gh auth login"; exit 1; }
[[ -f "$PROPS" ]] || { echo "Missing $PROPS — run npm run android:setup-signing or restore your backup."; exit 1; }
[[ -n "$PLAY_JSON" && -f "$PLAY_JSON" ]] || { echo "Usage: npm run android:ci-secrets -- /path/to/play-service-account.json"; exit 1; }

prop() { grep -E "^$1=" "$PROPS" | head -1 | cut -d= -f2-; }
KEYSTORE="$ANDROID/$(prop storeFile)"
[[ -f "$KEYSTORE" ]] || { echo "Missing keystore at $KEYSTORE"; exit 1; }

cd "$ROOT"
base64 < "$KEYSTORE" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
prop storePassword | tr -d '\n' | gh secret set ANDROID_KEYSTORE_PASSWORD
prop keyPassword | tr -d '\n' | gh secret set ANDROID_KEY_PASSWORD
gh secret set PLAY_SERVICE_ACCOUNT_JSON < "$PLAY_JSON"
gh variable set ANDROID_KEY_ALIAS --body "$(prop keyAlias)"

echo "Done. Secrets set:"
gh secret list
