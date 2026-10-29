#!/bin/bash
# backup.sh [--tag TAG] — one backup pair: the database, then the media,
# into the off-box restic repository (deployment.md "Backups").
#
# THE ORDER IS THE PAIRING. Objects are written before the row that points
# at them (architecture.md "Infrastructure"), so a dump taken FIRST only
# references objects that already exist when the media copy starts after
# it. The nightly pair therefore needs no downtime; the pre-deploy pair is
# taken with the API stopped anyway (deploy.sh).
#
# The whole database is dumped, the stand-in's l1_* tables included: on
# the stand-in they are the published sequence's only copy, and they hold
# the host seal seed — every dump is secret-bearing, and restic encrypts it.
#
# Run nightly by cogra-backup.timer (tag `nightly`) and by deploy.sh before
# every deploy (tag `pre-deploy`). Prints the snapshot id on stdout.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$(readlink -f "$0")")/lib.sh"

tag=manual
while [ $# -gt 0 ]; do
  case $1 in
    --tag) tag=${2:?--tag needs a value}; shift 2 ;;
    *) die "usage: backup.sh [--tag TAG]" ;;
  esac
done

restic_env
load_env buckets.env
: "${BACKUP_STAGING:?}" "${BACKUP_KEEP_DAILY:?}" "${BACKUP_KEEP_WEEKLY:?}"

umask 077
mkdir -p "$BACKUP_STAGING/db" "$BACKUP_STAGING/media" "$BACKUP_STAGING/held"
total_start=$SECONDS
revision=$(revision_of localhost/cogra-api:deployed || true)
revision=${revision:-unknown}

# 1. The database, first. Custom format: pg_restore restores it selectively.
dump_db() {
  podman exec cogra-postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    >"$BACKUP_STAGING/db/cogra.dump.partial"
  mv "$BACKUP_STAGING/db/cogra.dump.partial" "$BACKUP_STAGING/db/cogra.dump"
}
timed "database dump" dump_db

# 2. The media, after: an S3-level mirror, restorable into any S3 store.
timed "live bucket mirror" mirror_bucket cogra-media cogra-media "$MEDIA_BUCKET" "$BACKUP_STAGING/media" pull
timed "carried bucket mirror" mirror_bucket cogra-media cogra-media "$MEDIA_CARRIED_BUCKET" "$BACKUP_STAGING/media" pull
timed "held bucket mirror" mirror_bucket cogra-media-held cogra-held "$MEDIA_HELD_BUCKET" "$BACKUP_STAGING/held" pull

# 3. Off the box, encrypted, tagged with the deployed revision — the pair's
#    stamp, as the dev ritual stamps a dump with its commit.
snapshot_file=$(mktemp)
trap 'rm -f "$snapshot_file"' EXIT
send() {
  "$RESTIC" backup --quiet --json --host cogra \
    --tag cogra --tag "$tag" --tag "rev:$revision" \
    "$BACKUP_STAGING" | grep -o '"snapshot_id":"[0-9a-f]*"' | cut -d'"' -f4 >"$snapshot_file"
}
timed "restic backup" send
snapshot=$(cat "$snapshot_file")
[ -n "$snapshot" ] || die "restic reported no snapshot id"

# 4. Retention (D-6). Pre-deploy snapshots age out under the same policy.
timed "restic forget" "$RESTIC" forget --quiet --host cogra --tag cogra \
  --keep-daily "$BACKUP_KEEP_DAILY" --keep-weekly "$BACKUP_KEEP_WEEKLY" --prune

log "backup pair $snapshot (tag $tag, rev $revision) took $((SECONDS - total_start)) s"
echo "$snapshot"
