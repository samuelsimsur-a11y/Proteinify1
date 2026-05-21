#!/usr/bin/env bash
# One-time: create release keystore + android/keystore.properties (gitignored).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"
KEYSTORE="$ANDROID/wisedish-release.keystore"
PROPS="$ANDROID/keystore.properties"
CREDS="$ANDROID/SIGNING_CREDENTIALS.txt"

if [[ -f "$KEYSTORE" && -f "$PROPS" ]]; then
  echo "Signing already configured: $KEYSTORE"
  exit 0
fi

gen_pass() {
  openssl rand -base64 32 | tr -d '/+=' | head -c 24
}

STORE_PASS="$(gen_pass)"
# PKCS12 (default since Java 9) requires the same password for store and key.
KEY_PASS="$STORE_PASS"
ALIAS="wisedish"

echo "==> Generating release keystore at android/wisedish-release.keystore"
keytool -genkey -v \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype PKCS12 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=Samuel Suresh, OU=Wise Dish, O=Wise Dish, L=Etobicoke, ST=ON, C=CA"

cat > "$PROPS" <<EOF
storeFile=wisedish-release.keystore
storePassword=${STORE_PASS}
keyAlias=${ALIAS}
keyPassword=${KEY_PASS}
EOF

cat > "$CREDS" <<EOF
Wise Dish Android signing — BACK UP AND DELETE THIS FILE FROM SHARED DRIVES
Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Keystore file: android/wisedish-release.keystore
Key alias: ${ALIAS}
Keystore password: ${STORE_PASS}
Key password: ${KEY_PASS}

You cannot change the keystore after publishing to Google Play.
Store these in 1Password / iCloud Keychain and keep a copy of the .keystore file offline.
EOF
chmod 600 "$PROPS" "$CREDS" 2>/dev/null || true

echo "==> Wrote $PROPS (gitignored)"
echo "==> Wrote $CREDS — copy passwords to a password manager, then keep file local only"
echo "Done. Run: npm run android:bundle-release"
