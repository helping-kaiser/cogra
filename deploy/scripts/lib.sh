# lib.sh — shared by the operator scripts in /usr/local/lib/cogra
# (deployment.md "Operator scripts"). Sourced, never run.
#
# Bash, run as root on the production host. The scripts read their
# configuration from /etc/cogra and never print a secret: credentials
# reach containers as podman secrets, and restic reads its password from
# a file.

COGRA_ETC=${COGRA_ETC:-/etc/cogra}
COGRA_LIB=${COGRA_LIB:-/usr/local/lib/cogra}
COGRA_STATE=${COGRA_STATE:-/var/lib/cogra}

# Prefixed, timestamped lines on stderr, so a timer's journal reads as a log.
log() {
  printf '%s %s: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${0##*/}" "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

# Sources one of the shell-format env files (backup.env, alert.env,
# buckets.env, …). The container env files are read by podman literally;
# these few are also sourced by bash, so their values carry no spaces.
load_env() {
  local file="$COGRA_ETC/$1"
  [ -r "$file" ] || die "$file is missing (install it from deploy/env/$1.example)"
  set -a
  # shellcheck disable=SC1090
  . "$file"
  set +a
}

# Runs a step and logs its wall time: every action reports its duration
# (deployment.md "Budgets").
timed() {
  local label=$1
  shift
  local start=$SECONDS
  "$@"
  log "$label took $((SECONDS - start)) s"
}

# The image a running unit's container was started from, so a helper
# container uses exactly the pin the unit does.
image_of() {
  podman container inspect "$1" --format '{{.ImageName}}'
}

# The git revision an image was built from (its OCI revision label).
revision_of() {
  podman image inspect "$1" --format '{{ index .Labels "org.opencontainers.image.revision" }}' 2>/dev/null
}

# restic, with the repository and password from backup.env and any
# backend credentials from their own root-only file.
restic_env() {
  load_env backup.env
  : "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD_FILE:?}"
  if [ -n "${BACKUP_CREDENTIALS_FILE:-}" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$BACKUP_CREDENTIALS_FILE"
    set +a
  fi
  export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE
}
RESTIC=${RESTIC:-restic}

# Mirrors one bucket between a store and a host directory, in a throwaway
# container of the store's own image on the internal network. The store's
# root credentials come from its podman secrets.
#   mirror_bucket <store container> <secret prefix> <bucket> <host dir> pull|push [network]
mirror_bucket() {
  local store=$1 prefix=$2 bucket=$3 dir=$4 direction=$5 network=${6:-cogra-internal}
  local image
  image=$(image_of "$store")
  mkdir -p "$dir/$bucket"
  local cmd
  # The commands are expanded by the container's shell, not this one.
  # shellcheck disable=SC2016
  if [ "$direction" = pull ]; then
    cmd='mc mirror --overwrite --remove --quiet "s/$BUCKET" "/data/$BUCKET" >/dev/null'
  else
    cmd='mc mb --ignore-existing "s/$BUCKET" && mc mirror --overwrite --remove --quiet "/data/$BUCKET" "s/$BUCKET" >/dev/null'
  fi
  podman run --rm --pull=never --network "$network" \
    --secret "$prefix-root-user,type=env,target=MC_ROOT_USER" \
    --secret "$prefix-root-password,type=env,target=MC_ROOT_PASSWORD" \
    -e "STORE_URL=http://$store:9000" -e "BUCKET=$bucket" \
    -v "$dir:/data" \
    --entrypoint /bin/sh "$image" -euc \
    "mc alias set s \"\$STORE_URL\" \"\$MC_ROOT_USER\" \"\$MC_ROOT_PASSWORD\" >/dev/null && $cmd"
}
