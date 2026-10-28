#!/bin/bash
# alert.sh [--once KEY HOURS] TITLE MESSAGE — post an alert to the
# operator's ntfy topic (deployment.md "Monitoring").
#
# --once suppresses a repeat of the same KEY for HOURS, so a condition a
# timer sees every few minutes alerts once rather than every run.
# The message names a condition and where to look; it never carries log
# content or user data — the topic is a URL, not a vault.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$(readlink -f "$0")")/lib.sh"

if [ "${1:-}" = --once ]; then
  key=${2:?--once needs a key}
  hours=${3:?--once needs hours}
  shift 3
  stamp="$COGRA_STATE/alerts/$key"
  mkdir -p "$COGRA_STATE/alerts"
  if [ -n "$(find "$stamp" -mmin "-$((hours * 60))" 2>/dev/null)" ]; then
    exit 0
  fi
fi
title=${1:?usage: alert.sh [--once KEY HOURS] TITLE MESSAGE}
message=${2:?usage: alert.sh [--once KEY HOURS] TITLE MESSAGE}

load_env alert.env
: "${NTFY_URL:?}"
log "alert: $title — $message"
curl -fsS --max-time 20 -H "Title: $title" -H "Priority: high" -H "Tags: warning" \
  --data "$message" "$NTFY_URL" >/dev/null
# Stamped only once the post went through: a failed post is retried on the
# next run rather than silenced for the window.
if [ -n "${stamp:-}" ]; then touch "$stamp"; fi
