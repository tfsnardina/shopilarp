#!/usr/bin/env bash
set -euo pipefail
APP="${1:?app path}"
OUT="${2:?output ipa path}"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp -d)"
mkdir -p "$TMP/Payload"
cp -R "$APP" "$TMP/Payload/"
( cd "$TMP" && zip -qr "$OUT" Payload )
echo "Wrote $OUT"
