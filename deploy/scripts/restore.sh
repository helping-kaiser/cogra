#!/bin/bash
# restore.sh drill [SNAPSHOT]
# restore.sh production SNAPSHOT --overwrite-production
#
# drill       (R-1, deployment.md "Restore drill") restores a snapshot into
#             a scratch Postgres, a scratch media store and a scratch API on
#             a scratch internal network, runs read-only checks, and tears
#             everything down. The production units are never touched. A
#             backup whose drill was never run counts as no backup.
# production  replaces the live database and media with a snapshot: the
#             rollback across a migration and the disaster restore. It stops
#             the API, web and ranker, and leaves them stopped; deploy.sh
#             or systemctl starts them on the image that matches the data.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$(readlink -f "$0")")/lib.sh"

usage() { die "usage: restore.sh drill [SNAPSHOT] | restore.sh production SNAPSHOT --overwrite-production"; }
mode=${1:-}
snapshot=${2:-latest}
case $mode in
  drill) ;;
  production)
    if [ -z "${2:-}" ] || [ "${3:-}" != --overwrite-production ]; then usage; fi
    ;;
  *) usage ;;
esac

restic_env
load_env buckets.env
: "${BACKUP_STAGING:?}"
umask 077
total_start=$SECONDS

work=$(mktemp -d "$COGRA_STATE/restore.XXXXXX")
drill_names=(cogra-drill-api cogra-drill-media cogra-drill-postgres)
cleanup() {
  if [ "$mode" = drill ]; then
    podman rm -f -i "${drill_names[@]}" >/dev/null 2>&1 || true
    podman network rm -f cogra-drill >/dev/null 2>&1 || true
    podman secret rm cogra-drill-pg cogra-drill-root-user cogra-drill-root-password >/dev/null 2>&1 || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT

timed "restic restore" "$RESTIC" restore --quiet "$snapshot" --target "$work"
restored=$work$BACKUP_STAGING
[ -s "$restored/db/cogra.dump" ] || die "snapshot $snapshot holds no database dump"

if [ "$mode" = production ]; then
  log "stopping cogra-web, cogra-ranker and cogra-api"
  systemctl stop cogra-web.service cogra-ranker.service cogra-api.service
  # shellcheck disable=SC2317 # called through timed
  restore_db() {
    # --clean --if-exists drops what the dump recreates: the database ends
    # as the snapshot had it, migrations table included.
    podman exec -i cogra-postgres sh -c \
      'pg_restore --clean --if-exists --no-owner --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
      <"$restored/db/cogra.dump"
  }
  timed "database restore" restore_db
  # --remove: objects newer than the snapshot are referenced by no
  # restored row, so the stores end exactly as the pair had them.
  timed "live bucket restore" mirror_bucket cogra-media cogra-media "$MEDIA_BUCKET" "$restored/media" push
  timed "carried bucket restore" mirror_bucket cogra-media cogra-media "$MEDIA_CARRIED_BUCKET" "$restored/media" push
  timed "held bucket restore" mirror_bucket cogra-media-held cogra-held "$MEDIA_HELD_BUCKET" "$restored/held" push
  log "production restored from $snapshot in $((SECONDS - total_start)) s; cogra-api, cogra-web and cogra-ranker are stopped"
  exit 0
fi

# ---- drill ----
pg_image=$(image_of cogra-postgres)
media_image=$(image_of cogra-media)
api_image=localhost/cogra-api:deployed

podman network create --internal cogra-drill >/dev/null
printf '%s' "$(openssl rand -hex 24)" | podman secret create cogra-drill-pg - >/dev/null
printf 'drill' | podman secret create cogra-drill-root-user - >/dev/null
printf '%s' "$(openssl rand -hex 24)" | podman secret create cogra-drill-root-password - >/dev/null

podman run -d --name cogra-drill-postgres --network cogra-drill --pull=never \
  --secret cogra-drill-pg,type=env,target=POSTGRES_PASSWORD \
  -e POSTGRES_USER=cogra -e POSTGRES_DB=cogra "$pg_image" >/dev/null
podman run -d --name cogra-drill-media --network cogra-drill --pull=never \
  --secret cogra-drill-root-user,type=env,target=MINIO_ROOT_USER \
  --secret cogra-drill-root-password,type=env,target=MINIO_ROOT_PASSWORD \
  -e MINIO_BROWSER=off "$media_image" server /data >/dev/null

wait_for() {
  local what=$1
  shift
  for _ in $(seq 1 120); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  die "$what did not become ready"
}
wait_for "scratch postgres" podman exec cogra-drill-postgres pg_isready -h 127.0.0.1 -U cogra
wait_for "scratch media store" podman exec cogra-drill-media mc ready local

restore_drill_db() {
  podman exec -i cogra-drill-postgres pg_restore --no-owner --exit-on-error -U cogra -d cogra \
    <"$restored/db/cogra.dump"
}
timed "database restore" restore_drill_db
timed "live bucket restore" mirror_bucket cogra-drill-media cogra-drill "$MEDIA_BUCKET" "$restored/media" push cogra-drill
timed "carried bucket restore" mirror_bucket cogra-drill-media cogra-drill "$MEDIA_CARRIED_BUCKET" "$restored/media" push cogra-drill
timed "held bucket restore" mirror_bucket cogra-drill-media cogra-drill "$MEDIA_HELD_BUCKET" "$restored/held" push cogra-drill

# A scratch API on the restored pair: no route from the proxy, no mail, no
# epoch clock, no breach lookups — it only has to come up and answer.
podman run -d --name cogra-drill-api --network cogra-drill --pull=never \
  --env-file "$COGRA_ETC/buckets.env" \
  --secret cogra-drill-pg,type=env,target=PGPASSWORD \
  --secret cogra-drill-root-user,type=env,target=MEDIA_ACCESS_KEY_ID \
  --secret cogra-drill-root-password,type=env,target=MEDIA_SECRET_ACCESS_KEY \
  -e DATABASE_URL=postgres://cogra@cogra-drill-postgres:5432/cogra \
  -e MEDIA_S3_ENDPOINT=http://cogra-drill-media:9000 \
  -e MAILER=dev -e BREACH_CHECK=off -e CLIENT_IP_SOURCE=ConnectInfo -e RUST_LOG=info \
  "$api_image" >/dev/null
wait_for "scratch api" podman exec cogra-drill-api /usr/local/bin/http-health 8080 /health

# Check 1: the API reads the restored database.
health=$(podman run --rm --pull=never --network cogra-drill "$pg_image" \
  wget -qO- --header 'Content-Type: application/json' \
  --post-data '{"query":"{ health { backendVersion postgresConnected mirrorEpoch } }"}' \
  http://cogra-drill-api:8080/graphql)
log "drill health: $health"
case $health in
  *'"postgresConnected":true'*) ;;
  *) die "the scratch API does not read the restored database" ;;
esac

# Check 2: the rows' media is in the restored store — a sample of live
# objects and every held one, looked up by the key the row names.
missing=0
checked=0
while IFS='|' read -r area key; do
  [ -n "$key" ] || continue
  case $area in
    live) bucket=$MEDIA_BUCKET ;;
    carried) bucket=$MEDIA_CARRIED_BUCKET ;;
    held) bucket=$MEDIA_HELD_BUCKET ;;
    *) continue ;;
  esac
  checked=$((checked + 1))
  if ! podman run --rm --pull=never --network cogra-drill \
    --secret cogra-drill-root-user,type=env,target=U \
    --secret cogra-drill-root-password,type=env,target=P \
    -e "OBJ=$bucket/$key" --entrypoint /bin/sh "$media_image" -euc \
    'mc alias set s http://cogra-drill-media:9000 "$U" "$P" >/dev/null && mc stat "s/$OBJ" >/dev/null'; then
    missing=$((missing + 1))
    log "missing object: $bucket/$key"
  fi
done < <(podman exec cogra-drill-postgres psql -U cogra -d cogra -tA -c \
  "(SELECT area, storage_key FROM media_attachments WHERE area = 'live' ORDER BY random() LIMIT 20)
   UNION ALL (SELECT area, storage_key FROM media_attachments WHERE area <> 'live')")
log "drill media: $checked objects checked, $missing missing"
[ "$missing" -eq 0 ] || die "the restored store is missing objects its rows name"

log "restore drill of $snapshot passed in $((SECONDS - total_start)) s"
