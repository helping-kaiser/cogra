#!/bin/bash
# deploy.sh HASH                       — deploy the images built at HASH
# deploy.sh --rollback-to HASH [--restore SNAPSHOT]
#
# (deployment.md "Deploy", "Rollback".) The images must already be loaded
# on the box as localhost/cogra-{api,web,ranker}:HASH. A deploy is:
#
#   1. stop web, ranker and API — the window starts;
#   2. take the pre-deploy backup pair with the API stopped;
#   3. retag HASH as :deployed — the units name only that tag;
#   4. start the API, which applies pending migrations before it listens,
#      and check _sqlx_migrations against the migrations the image carries;
#   5. start ranker and web, then smoke through the proxy (S-3, S-4).
#
# Migrations are forward-only: rolling back across one is a restore of the
# pre-deploy pair (--restore), never a down-migration. The release-registry
# row is published by hand after this, once the new web build serves
# (deployment.md "Release publish").
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$(readlink -f "$0")")/lib.sh"

usage() { die "usage: deploy.sh HASH | deploy.sh --rollback-to HASH [--restore SNAPSHOT]"; }
rollback=no
restore_snapshot=
case ${1:-} in
  --rollback-to)
    rollback=yes
    hash=${2:-}
    if [ "${3:-}" = --restore ]; then restore_snapshot=${4:?--restore needs a snapshot id}; fi
    ;;
  -*|"") usage ;;
  *) hash=$1 ;;
esac
[ -n "$hash" ] || usage
load_env proxy.env
: "${COGRA_DOMAIN:?}"
mkdir -p "$COGRA_STATE"
total_start=$SECONDS

components=(api web ranker)
for c in "${components[@]}"; do
  podman image exists "localhost/cogra-$c:$hash" \
    || die "localhost/cogra-$c:$hash is not loaded (podman load it first)"
done
previous=$(revision_of localhost/cogra-api:deployed || true)
log "deploying $hash (previous: ${previous:-none}, rollback: $rollback)"

migrations_in() {
  podman run --rm --pull=never --entrypoint /bin/sh "$1" -c 'ls /usr/share/cogra/migrations/*.sql | wc -l'
}
migrations_applied() {
  podman exec cogra-postgres sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM _sqlx_migrations WHERE success"'
}

expected=$(migrations_in "localhost/cogra-api:$hash")
# A database ahead of the image refuses the binary at start (sqlx finds an
# applied migration it does not carry), so that case stops here, before
# anything is touched, unless the rollback restores the matching pair.
if [ -z "$restore_snapshot" ]; then
  applied=$(migrations_applied)
  if [ "$applied" -gt "$expected" ]; then
    die "the database has $applied migrations applied and $hash carries $expected: rolling back across a migration needs --restore <pre-deploy snapshot> (see $COGRA_STATE/deploys.log)"
  fi
fi

timed "stop" systemctl stop cogra-web.service cogra-ranker.service cogra-api.service

if [ "$rollback" = no ]; then
  snapshot=$(timed "pre-deploy backup pair" "$COGRA_LIB/backup.sh" --tag pre-deploy)
  printf '%s deploy %s previous=%s snapshot=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$hash" "${previous:-none}" "$snapshot" >>"$COGRA_STATE/deploys.log"
  log "pre-deploy pair: $snapshot — the restore point if this deploy migrates and must roll back"
elif [ -n "$restore_snapshot" ]; then
  timed "restore of $restore_snapshot" "$COGRA_LIB/restore.sh" production "$restore_snapshot" --overwrite-production
  printf '%s rollback %s restored=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$hash" "$restore_snapshot" \
    >>"$COGRA_STATE/deploys.log"
else
  printf '%s rollback %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$hash" >>"$COGRA_STATE/deploys.log"
fi

for c in "${components[@]}"; do
  podman tag "localhost/cogra-$c:$hash" "localhost/cogra-$c:deployed"
done

# The unit's ExecStartPost waits for the healthy API, migrations included.
timed "api start (migrations)" systemctl start cogra-api.service
applied=$(migrations_applied)
log "migrations: image carries $expected, database has $applied applied"
[ "$applied" -eq "$expected" ] || die "the database has $applied migrations applied, the image carries $expected"
timed "ranker and web start" systemctl start cogra-ranker.service cogra-web.service

# S-3: end to end through the proxy.
health=$(curl -fsS --max-time 20 "https://$COGRA_DOMAIN/graphql" \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ health { backendVersion postgresConnected mirrorEpoch } }"}')
log "S-3 health: $health"
case $health in
  *'"postgresConnected":true'*) ;;
  *) die "S-3 failed: the API does not report its database through the proxy" ;;
esac
# S-4: release posture.
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$COGRA_DOMAIN/playground")
[ "$status" = 404 ] || die "S-4 failed: /playground answered $status, not 404"
intro=$(curl -sS --max-time 20 "https://$COGRA_DOMAIN/graphql" \
  -H 'Content-Type: application/json' --data '{"query":"{ __schema { queryType { name } } }"}')
case $intro in
  *'"queryType":{"name"'*) die "S-4 failed: introspection answered" ;;
esac

log "deployed $hash in $((SECONDS - total_start)) s"
if [ "$rollback" = no ]; then
  log "next, once the web build serves: podman exec -i cogra-api release publish --component web --version <v> --notes-file /dev/stdin < notes.txt"
fi
