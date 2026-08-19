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
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo ".env not found (run make init first)"; exit 1; }

IP=$(ip -4 route get 1.1.1.1 2>/dev/null | grep -oE 'src [0-9.]+' | awk '{print $2}')
[ -n "$IP" ] || { echo "no routable IPv4 found"; exit 1; }

sed -i -E "s#^DATABASE_URL=postgres://([^@]+)@[^:/]+:#DATABASE_URL=postgres://\1@${IP}:#" .env
sed -i -E "s#^WEB_ORIGIN=https?://[^:/]+#WEB_ORIGIN=https://${IP}#" .env

grep -E '^(DATABASE_URL|WEB_ORIGIN)=' .env
echo "stamped ${IP}"
