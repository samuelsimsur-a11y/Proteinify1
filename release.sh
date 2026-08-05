#!/usr/bin/env bash
# Wise Dish release pipeline — dry-run by default. Pass --live to perform network writes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

usage() {
  cat <<'EOF'
Usage:
  ./release.sh <patch|minor|major> [--track <literal-play-track>] [--live] [--skip-web] [--skip-android]
  ./release.sh promote-web <deployment-url>

Defaults:
  --track internal
  dry-run (no network writes) unless --live

Web: --live runs `vercel deploy` (preview only). Promote with:
  ./release.sh promote-web <url>
Never runs vercel --prod.
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

if [[ "$1" == "promote-web" ]]; then
  URL="${2:-}"
  if [[ -z "$URL" ]]; then
    echo "Usage: ./release.sh promote-web <deployment-url>"
    exit 1
  fi
  echo "promote-web\t$URL"
  vercel promote "$URL"
  exit 0
fi

KIND="$1"
shift
if [[ "$KIND" != "patch" && "$KIND" != "minor" && "$KIND" != "major" ]]; then
  usage
  exit 1
fi

TRACK="internal"
LIVE=0
SKIP_WEB=0
SKIP_ANDROID=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --track)
      TRACK="${2:-}"
      shift 2
      ;;
    --live)
      LIVE=1
      shift
      ;;
    --skip-web)
      SKIP_WEB=1
      shift
      ;;
    --skip-android)
      SKIP_ANDROID=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      usage
      exit 1
      ;;
  esac
done

run() {
  echo "+ $*"
  if [[ "$LIVE" -eq 1 ]]; then
    eval "$@"
  fi
}

echo "=== release.sh ==="
echo "kind=$KIND track=$TRACK live=$LIVE skip_web=$SKIP_WEB skip_android=$SKIP_ANDROID"
echo

# --- What android:bundle-release does (invoked as-is; do not reimplement) ---
# npm run android:bundle-release
#   → npm run build:android
#        → guard:android-build
#        → icons:android
#        → WISEDISH_STATIC_EXPORT=true next build   # static UI into out/
#        → npx cap sync android                      # copies out/ into Android assets
#   → cd android && ./gradlew bundleRelease          # signed AAB from synced assets
# Skipping cap sync would ship a stale web bundle inside the AAB.

PREFLIGHT_ARGS=(--track "$TRACK")
if [[ "$LIVE" -eq 1 ]]; then
  PREFLIGHT_ARGS+=(--require-play --require-play-seed)
fi

echo "--- preflight (before bump) ---"
if [[ "$LIVE" -eq 1 ]]; then
  node scripts/preflight.js "${PREFLIGHT_ARGS[@]}"
else
  echo "+ node scripts/preflight.js ${PREFLIGHT_ARGS[*]}"
  node scripts/preflight.js --track "$TRACK" || true
  echo "(dry-run: preflight warnings above are informational if Play credentials missing)"
fi

echo "--- bump ---"
if [[ "$LIVE" -eq 1 ]]; then
  node scripts/bump-version.js "$KIND"
else
  echo "+ node scripts/bump-version.js $KIND"
  echo "(dry-run: would bump version.json)"
fi

if [[ "$LIVE" -eq 1 ]]; then
  echo "--- preflight (after bump) ---"
  node scripts/preflight.js --track "$TRACK" --require-play --require-play-seed --after-bump
fi

VERSION_NAME="$(node -e "console.log(require('./version.json').versionName)")"
VERSION_CODE="$(node -e "console.log(require('./version.json').versionCode)")"
echo "versionName=$VERSION_NAME versionCode=$VERSION_CODE"

echo "--- stamp version into public/ ---"
run "node scripts/stamp-version.js"
if [[ "$LIVE" -eq 0 ]]; then
  echo "+ node scripts/stamp-version.js"
fi

AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"
WEB_URL=""

if [[ "$SKIP_ANDROID" -eq 0 ]]; then
  echo "--- Android AAB (npm run android:bundle-release) ---"
  run "npm run android:bundle-release"
  if [[ "$LIVE" -eq 0 ]]; then
    echo "+ npm run android:bundle-release"
    echo "  (chains build:android → cap sync → gradlew bundleRelease)"
  fi

  echo "--- upload to Play track=$TRACK (GPP) ---"
  if [[ "$LIVE" -eq 1 ]]; then
    if [[ -z "${PLAY_SERVICE_ACCOUNT_JSON:-}" ]]; then
      echo "PLAY_SERVICE_ACCOUNT_JSON required for upload"
      exit 1
    fi
    (cd android && ./gradlew publishBundle --track="$TRACK")
  else
    echo "+ (cd android && ./gradlew publishBundle --track=$TRACK)"
    echo "  (requires PLAY_SERVICE_ACCOUNT_JSON; GPP 4.0.0; never production from this script)"
  fi
fi

if [[ "$SKIP_WEB" -eq 0 ]]; then
  echo "--- stamp + web build ---"
  run "node scripts/stamp-version.js"
  run "npm run build"
  if [[ "$LIVE" -eq 0 ]]; then
    echo "+ node scripts/stamp-version.js && npm run build"
  fi

  echo "--- vercel deploy (preview only) ---"
  if [[ "$LIVE" -eq 1 ]]; then
    # Capture deployment URL from vercel deploy JSON output
    DEPLOY_JSON="$(vercel deploy --yes --format json 2>/dev/null || vercel deploy --yes)"
    if echo "$DEPLOY_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);console.log(j.url||j.alias||'')}catch{console.log('')}})"; then
      :
    fi
    WEB_URL="$(echo "$DEPLOY_JSON" | node -e "
      let s='';
      process.stdin.on('data', d => s += d);
      process.stdin.on('end', () => {
        try {
          const j = JSON.parse(s);
          const u = j.url || j.deploymentUrl || j.alias || '';
          console.log(u.startsWith('http') ? u : (u ? 'https://' + u : ''));
        } catch {
          const m = s.match(/https:\\/\\/[a-z0-9.-]+\\.vercel\\.app/);
          console.log(m ? m[0] : '');
        }
      });
    ")"
    if [[ -z "$WEB_URL" ]]; then
      echo "Failed to parse Vercel deployment URL from deploy output"
      echo "$DEPLOY_JSON" | tail -20
      exit 1
    fi
    echo "web_preview_url=$WEB_URL"
  else
    echo "+ vercel deploy --yes"
    echo "  (preview URL would be passed to verify.js; promote later via ./release.sh promote-web <url>)"
  fi
fi

echo "--- verify ---"
VERIFY_ARGS=(--version-code "$VERSION_CODE" --version-name "$VERSION_NAME")
if [[ "$SKIP_ANDROID" -eq 1 ]]; then
  VERIFY_ARGS+=(--skip-play)
else
  VERIFY_ARGS+=(--track "$TRACK")
fi
if [[ "$SKIP_WEB" -eq 1 ]]; then
  VERIFY_ARGS+=(--skip-web)
elif [[ "$LIVE" -eq 1 && -n "$WEB_URL" ]]; then
  VERIFY_ARGS+=(--web-url "$WEB_URL")
fi

if [[ "$LIVE" -eq 1 ]]; then
  if [[ "$SKIP_WEB" -eq 0 && -z "$WEB_URL" ]]; then
    echo "No web URL to verify"
    exit 1
  fi
  node scripts/verify.js "${VERIFY_ARGS[@]}"
else
  echo "+ node scripts/verify.js ${VERIFY_ARGS[*]} --web-url <preview-url>"
fi

echo
echo "=== summary ==="
echo "kind=$KIND"
echo "versionName=$VERSION_NAME"
echo "versionCode=$VERSION_CODE"
echo "track=$TRACK"
echo "live=$LIVE"
echo "aab=$AAB_PATH"
echo "web_preview_url=${WEB_URL:-"(dry-run)"}"
if [[ "$LIVE" -eq 1 && -n "$WEB_URL" ]]; then
  echo "Next: inspect preview, then ./release.sh promote-web $WEB_URL"
fi
if [[ "$LIVE" -eq 0 ]]; then
  echo "Dry-run complete. Re-run with --live after Phase 3 credentials + seed."
fi
