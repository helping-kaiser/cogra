#!/bin/bash
# bootstrap.sh — the one-time genesis bootstrap (B-12; architecture.md
# "Genesis bootstrap"), run by hand in a terminal, never by a unit.
#
# Its one-time recovery code is printed to THIS terminal: a unit would put
# it in the journal. Copy it into the password manager before closing the
# terminal. Idempotent: a re-run on a bootstrapped instance writes nothing.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$(readlink -f "$0")")/lib.sh"

[ -t 1 ] || die "run this in an interactive terminal: it prints the recovery code once"
[ -r "$COGRA_ETC/bootstrap.env" ] || die "$COGRA_ETC/bootstrap.env is missing"
podman secret exists cogra-genesis-password \
  || die "create the secret first: podman secret create cogra-genesis-password - (then type it, Ctrl-D)"
systemctl is-active --quiet cogra-api.service || die "cogra-api must be running (it migrates the database)"

podman run --rm -it --pull=never --network cogra-internal \
  --env-file "$COGRA_ETC/buckets.env" \
  --env-file "$COGRA_ETC/api.env" \
  --env-file "$COGRA_ETC/bootstrap.env" \
  --secret cogra-postgres-password,type=env,target=PGPASSWORD \
  --secret cogra-genesis-password,type=env,target=GENESIS_PASSWORD \
  --entrypoint /usr/local/bin/bootstrap \
  localhost/cogra-api:deployed
