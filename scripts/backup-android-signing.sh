#!/usr/bin/env bash
# Copy Android release signing assets to a labeled folder outside the git repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"
DATE="$(date +%Y-%m-%d)"
DEST="${WISEDISH_SIGNING_BACKUP_DIR:-$HOME/Documents/WiseDish-Android-Play-Signing-Backup}"

KEYSTORE="$ANDROID/wisedish-release.keystore"
PROPS="$ANDROID/keystore.properties"
CREDS="$ANDROID/SIGNING_CREDENTIALS.txt"

for f in "$KEYSTORE" "$PROPS" "$CREDS"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing required file: $f"
    echo "Run: npm run android:setup-signing"
    exit 1
  fi
done

mkdir -p "$DEST"
chmod 700 "$DEST"

cp "$KEYSTORE" "$DEST/wisedish-release.keystore"
cp "$PROPS" "$DEST/keystore.properties"
cp "$CREDS" "$DEST/SIGNING_CREDENTIALS.txt"
chmod 600 "$DEST"/*.keystore "$DEST/keystore.properties" "$DEST/SIGNING_CREDENTIALS.txt" 2>/dev/null || true

STORE_PASS="$(grep '^storePassword=' "$PROPS" | cut -d= -f2-)"
ALIAS="$(grep '^keyAlias=' "$PROPS" | cut -d= -f2-)"
keytool -list -v -keystore "$DEST/wisedish-release.keystore" -storepass "$STORE_PASS" -alias "$ALIAS" \
  2>/dev/null | grep -E 'Alias name:|SHA256:|Valid from:' > "$DEST/certificate-sha256-fingerprint.txt" || true
chmod 644 "$DEST/certificate-sha256-fingerprint.txt" 2>/dev/null || true

cat > "$DEST/README-FIRST.txt" <<EOF
Wise Dish — Android Play Store signing backup
=============================================
Backed up: ${DATE}
App package: com.wisedish.app
Key alias: wisedish

FILES IN THIS FOLDER
--------------------
wisedish-release.keystore     Upload/signing key (keep forever after first Play upload)
keystore.properties           Gradle passwords (gitignored in project)
SIGNING_CREDENTIALS.txt       Human-readable copy of passwords — also store in 1Password
certificate-sha256-fingerprint.txt  Safe to share with Play Console support if needed

RESTORE INTO PROJECT
--------------------
cp wisedish-release.keystore keystore.properties SIGNING_CREDENTIALS.txt \\
  /path/to/wisedish/android/

GOOGLE DRIVE
------------
No Google Drive sync was detected on this Mac when the backup ran.
Drag this entire folder to https://drive.google.com (or install Google Drive for desktop
and copy this folder into My Drive). Use a private folder; do not share the link publicly.

SECURITY
--------
- Do not commit these files to git.
- Do not email or Slack the keystore or SIGNING_CREDENTIALS.txt.
- If you lose this keystore after publishing to Play, you cannot ship updates without a key reset.

Project script: npm run android:backup-signing
EOF
chmod 644 "$DEST/README-FIRST.txt"

ZIP="$DEST/../WiseDish-Android-Play-Signing-Backup-${DATE}.zip"
(
  cd "$(dirname "$DEST")"
  zip -r -q "$(basename "$ZIP")" "$(basename "$DEST")"
)
chmod 600 "$ZIP" 2>/dev/null || true

echo "Backup folder: $DEST"
echo "Zip archive:   $ZIP"
ls -la "$DEST"
