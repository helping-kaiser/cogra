#!/usr/bin/env bash
# The precondition measurement of ARCH dec:linter:kotlin-tree-sitter:
# parse every Kotlin file in the Android corpus and count error nodes.
# Zero is the precondition.
#
# Counts ERROR and MISSING nodes in the full parse trees rather than
# reading tree-sitter's summary line, so a file with several errors is
# counted as several.
#
# Usage: scripts/measure.sh [kt|kts]
#   kt  (default) the app source, which the precondition is about
#   kts the 18 Gradle scripts, which are a separate and undecided
#       question — the specification parses those with its `script`
#       production, not `kotlinFile`, and this grammar implements
#       `kotlinFile`. Measured here as input to that decision, nothing
#       more.
set -uo pipefail

ext="${1:-kt}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
corpus="$repo/android"

if [ ! -d "$corpus" ]; then
  echo "no corpus at $corpus" >&2
  exit 2
fi

cd "$here"

files=0
bad_files=0
nodes=0
start=$(date +%s.%N)

while read -r f; do
  files=$((files + 1))
  n="$(tree-sitter parse "$f" 2>/dev/null | grep -c '(ERROR\|(MISSING')"
  if [ "$n" -gt 0 ]; then
    bad_files=$((bad_files + 1))
    nodes=$((nodes + n))
    echo "  $n  ${f#"$corpus/"}"
  fi
done < <(find "$corpus" -name "*.$ext" | sort)

end=$(date +%s.%N)

echo
echo "--- ARCH dec:linter:kotlin-tree-sitter precondition (.$ext) ---"
echo "files parsed:        $files"
echo "files with errors:   $bad_files"
echo "total ERROR/MISSING: $nodes"
awk -v a="$start" -v b="$end" 'BEGIN{printf "wall time:           %.2fs\n", b-a}'

[ "$nodes" -eq 0 ]
