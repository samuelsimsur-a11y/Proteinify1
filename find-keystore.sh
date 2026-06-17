#!/usr/bin/env zsh
# Find Android / Java keystore files under home and this project.

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="$SCRIPT_DIR"

echo "Searching home directory (~) and project ($PROJECT_DIR)..."
echo ""

typeset -a matches
matches=()

add_matches() {
  local path
  for path in "$@"; do
    [[ -f "$path" ]] && matches+=("$path")
  done
}

# 1–2. Project tree (always use find)
while IFS= read -r path; do
  add_matches "$path"
done < <(find "$PROJECT_DIR" \( -name '*.keystore' -o -name '*.jks' \) -type f 2>/dev/null)

# 1. Entire home directory
if [[ "$(/usr/bin/uname -s 2>/dev/null || uname -s)" == Darwin ]] && command -v mdfind >/dev/null 2>&1; then
  while IFS= read -r path; do
    add_matches "$path"
  done < <(
    mdfind -onlyin "$HOME" 'kMDItemFSName == "*.keystore" || kMDItemFSName == "*.jks"' 2>/dev/null
  )
else
  while IFS= read -r path; do
    add_matches "$path"
  done < <(
    find "$HOME" \
      \( \
        -path "$HOME/Library/Caches/*" -o \
        -path "$HOME/Library/Developer/CoreSimulator/*" -o \
        -path "$HOME/.npm/*" -o \
        -path "$HOME/.gradle/caches/*" -o \
        -path "*/node_modules/*" -o \
        -path "*/.git/*" \
      \) -prune -o \
      \( -name '*.keystore' -o -name '*.jks' \) -type f -print 2>/dev/null
  )
fi

typeset -a unique
unique=("${(@u)matches}")

if (( ${#unique[@]} == 0 )); then
  echo "No keystore found — you need to generate one"
  exit 0
fi

for path in "${unique[@]}"; do
  print -r -- "$path"
done
