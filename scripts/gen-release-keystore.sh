#!/usr/bin/env bash
# Generate a proper release keystore (replaces the debug keystore).
# Usage: ./scripts/gen-release-keystore.sh [output-path]
# Then: update credentials.json from credentials.json.example, back up the
# keystore + passwords in a password manager, and record the SHA-256
# (apksigner verify --print-certs) as RELEASE_CERT_SHA256.
set -euo pipefail

OUT="${1:-android/app/release.keystore}"
if [ -f "$OUT" ]; then
  echo "Refusing to overwrite existing $OUT"
  exit 1
fi

echo "Generating release keystore at $OUT"
echo "Use a strong store password + key password (not 'android')."
keytool -genkeypair -v \
  -keystore "$OUT" \
  -alias myanify \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Myanify, OU=Mobile, O=Myanify"

echo ""
echo "Done. Next:"
echo "  1. cp credentials.json.example credentials.json  (fill in passwords)"
echo "  2. Back up $OUT + passwords in 1Password (losing it = no more in-place updates)"
echo "  3. apksigner verify --print-certs <apk>  -> save SHA-256 as RELEASE_CERT_SHA256"
echo "  4. After switching keys, users must reinstall once (Android rejects different signer as update)."
