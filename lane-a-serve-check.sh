#!/bin/bash
# Put a real object into the media store and read it back over HTTP, at
# the store's own origin. Proves the bucket is anonymously readable and
# that the object carries the immutable cache posture.
set -uo pipefail
KEY="lane-a-probe.webp"
printf 'RIFF\x14\x00\x00\x00WEBPVP8L\x08\x00\x00\x00\x2f\x00\x00\x00\x00\x88\x88\x08' > /tmp/probe.webp

podman cp /tmp/probe.webp gnp_media:/tmp/probe.webp
podman exec gnp_media mc alias set store http://127.0.0.1:9000 cogra_media cogra_media_secret > /dev/null
podman exec gnp_media mc cp --attr "Cache-Control=public, max-age=31536000, immutable" \
    /tmp/probe.webp "store/cogra-media/${KEY}" 2>&1 | tail -1

echo "---- anonymous GET at the store origin ----"
podman exec gnp_media curl -sS -D - -o /tmp/got.webp "http://127.0.0.1:9000/cogra-media/${KEY}" \
    | grep -iE '^(HTTP|content-type|cache-control|content-length)'
echo "---- bytes match ----"
podman exec gnp_media cmp /tmp/probe.webp /tmp/got.webp && echo "identical"
