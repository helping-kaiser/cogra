#!/bin/bash
# log-alert.sh — alert on new ERROR lines from the app units since the last
# run (deployment.md "Monitoring"): the mailer's failed sends, the ingest
# loop, the ranker. Run by cogra-log-alert.timer.
#
# A container's stdout reaches the journal at priority info whatever the
# line says, so `journalctl -p err` would never fire: the match is on the
# tracing level in the text (the units run NO_COLOR=1, so it is plain).
# The alert carries counts, never the lines.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$(readlink -f "$0")")/lib.sh"

mkdir -p "$COGRA_STATE"
report=""
for unit in cogra-api cogra-ranker; do
  cursor="$COGRA_STATE/log-alert.$unit.cursor"
  # First run: start from now rather than alerting on history.
  if [ ! -e "$cursor" ]; then
    journalctl -u "$unit.service" -n 0 --show-cursor -q | sed -n 's/^-- cursor: //p' >"$cursor"
    continue
  fi
  count=$(journalctl -u "$unit.service" --cursor-file="$cursor" -q -o cat --no-pager \
    --grep '^\S+\s+ERROR\s' 2>/dev/null | wc -l || true)
  if [ "$count" -gt 0 ]; then
    report="$report $unit: $count;"
  fi
done
if [ -n "$report" ]; then
  "$COGRA_LIB/alert.sh" "CoGra errors on $(hostname)" \
    "New ERROR lines —$report see journalctl -u <unit> --grep ERROR."
fi
