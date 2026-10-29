#!/bin/bash
# disk-watch.sh — the disk alarm (deployment.md "Monitoring"): the data
# filesystem under DISK_MIN_FREE_PERCENT free, or the live media volume past
# MEDIA_ALERT_BYTES. Media is the growth term: uploads are rate-limited per
# account, not priced. Run by cogra-disk-watch.timer.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$(readlink -f "$0")")/lib.sh"
load_env alert.env
: "${DISK_MIN_FREE_PERCENT:?}" "${MEDIA_ALERT_BYTES:?}"

# Where podman keeps images and volumes: the data filesystem.
root=$(podman info --format '{{.Store.GraphRoot}}')
used=$(df -P "$root" | awk 'NR == 2 { sub("%", "", $5); print $5 }')
free=$((100 - used))
log "data filesystem ($root): $free% free"
if [ "$free" -lt "$DISK_MIN_FREE_PERCENT" ]; then
  "$COGRA_LIB/alert.sh" --once disk-free 6 "CoGra disk low on $(hostname)" \
    "The data filesystem has $free% free (alarm below $DISK_MIN_FREE_PERCENT%). Check: df -h $root; podman system df."
fi

mount=$(podman volume inspect cogra-media --format '{{.Mountpoint}}')
bytes=$(du -sb "$mount" | cut -f1)
log "live media volume: $bytes bytes"
if [ "$bytes" -gt "$MEDIA_ALERT_BYTES" ]; then
  "$COGRA_LIB/alert.sh" --once media-size 24 "CoGra media past its threshold on $(hostname)" \
    "The live media volume holds $bytes bytes (threshold $MEDIA_ALERT_BYTES)."
fi
