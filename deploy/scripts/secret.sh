#!/bin/bash
# secret.sh NAME [--random HEXBYTES] — create one podman secret
# (deployment.md "Configuration").
#
# The value is read from a silent prompt, or generated, and stored WITHOUT
# a trailing newline. That matters: `echo x | podman secret create` stores
# "x\n", and a credential that differs by a newline between its two
# consumers fails — a media store and its provisioning one-shot then
# disagree about the root password and every request is refused. Nothing
# is echoed, and the value never reaches the shell history.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$(readlink -f "$0")")/lib.sh"

name=${1:?usage: secret.sh NAME [--random HEXBYTES]}
if podman secret exists "$name"; then
  die "$name exists; rotating it is deliberate: podman secret rm $name first"
fi
if [ "${2:-}" = --random ]; then
  value=$(openssl rand -hex "${3:?--random needs a byte count}")
else
  read -rsp "value for $name: " value
  echo >&2
fi
[ -n "$value" ] || die "an empty value is not a secret"
printf '%s' "$value" | podman secret create "$name" - >/dev/null
log "created $name"
