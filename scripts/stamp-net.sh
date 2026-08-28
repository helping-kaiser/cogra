#!/bin/bash
# Stamp the dev machine's current LAN IPv4 into .env: the DATABASE_URL
# host and the WEB_ORIGIN. Run it inside the dev shell after every
# network change (e.g. home Wi-Fi <-> phone hotspot).
#
# Why an IP and not localhost: dev setups where the DB, the API, and
# the phones sit on different network namespaces (e.g. WSL toolboxes
# under mirrored networking, where distro-to-distro localhost does not
# exist) all converge on the host's LAN address — the API reaches the
# DB through it, and phones reach the web/API surfaces through the
# same address in WEB_ORIGIN.
#
# The address is also a name in the dev server's certificate, so it is
# re-issued here too, and the CA that signs it is staged where the debug
# Android build picks it up — a guest's app verifies that address the
# same way their browser does.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo ".env not found (run make init first)"; exit 1; }

IP=$(ip -4 route get 1.1.1.1 2>/dev/null | grep -oE 'src [0-9.]+' | awk '{print $2}')
[ -n "$IP" ] || { echo "no routable IPv4 found"; exit 1; }

sed -i -E "s#^DATABASE_URL=postgres://([^@]+)@[^:/]+:#DATABASE_URL=postgres://\1@${IP}:#" .env
sed -i -E "s#^WEB_ORIGIN=https?://[^:/]+#WEB_ORIGIN=https://${IP}#" .env
# The media store is stamped like the database: the API and the store
# can live in separate WSL distros, where cross-distro localhost is dead
# under mirrored networking and the LAN address is the working path. The
# host firewall keeps the store's port closed to other devices — exactly
# the posture the database already relies on — so stamping it does not
# put the bucket on the guests' network.
sed -i -E "s#^MEDIA_S3_ENDPOINT=https?://[^:/]+#MEDIA_S3_ENDPOINT=http://${IP}#" .env
#
# MEDIA_BASE_URL is the phone-facing half: it is the web origin, so bytes
# arrive over the https origin the app trusts via the /media proxy.
sed -i -E "s#^MEDIA_BASE_URL=https?://[^:/]+#MEDIA_BASE_URL=https://${IP}#" .env

grep -E '^(DATABASE_URL|WEB_ORIGIN|MEDIA_S3_ENDPOINT|MEDIA_BASE_URL)=' .env
echo "stamped ${IP}"

# The certificate and the CA behind it. Browsers reach the dev server past
# a warning whatever it is signed with, but the Android app has no such
# step: it verifies the chain and the address, so both have to be right.
if ! command -v mkcert >/dev/null 2>&1; then
    echo "mkcert not found — certificate left as is; the app cannot reach ${IP}" >&2
    echo "  install it (https://github.com/FiloSottile/mkcert) and re-run" >&2
    exit 0
fi

CERT_DIR=web/certificates
DEV_CA=android/app/src/devCa/res/raw/cogra_dev_ca.pem

mkdir -p "$CERT_DIR" "$(dirname "$DEV_CA")"
mkcert -cert-file "$CERT_DIR/localhost.pem" -key-file "$CERT_DIR/localhost-key.pem" \
    localhost 127.0.0.1 ::1 "$IP"
cp "$(mkcert -CAROOT)/rootCA.pem" "$DEV_CA"

echo "issued ${CERT_DIR}/localhost.pem for ${IP}; staged its CA at ${DEV_CA}"
echo "restart the web dev server, then rebuild the guest APK: make guest-apk"
