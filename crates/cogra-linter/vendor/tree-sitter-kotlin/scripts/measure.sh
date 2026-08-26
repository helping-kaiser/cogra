#!/usr/bin/env bash
# The precondition measurement of ARCH dec:linter:kotlin-tree-sitter:
# parse every Kotlin file in the Android corpus and count error nodes.
#
# Shaped after the measurement in ARCH rep:linter:kotlin-parser-study so
# the numbers are comparable with it.
#
# Usage: scripts/measure.sh [extension]   (default: kt; pass kts to
# measure the Gradle scripts, which are a separate, undecided question)
set -uo pipefail

ext="${1:-kt}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
corpus="$repo/android"

if [ ! -d "$corpus" ]; then
  echo "no corpus at $corpus" >&2
  exit 2
fi

mapfile -t files < <(find "$corpus" -name "*.$ext" | sort)
if [ "${#files[@]}" -eq 0 ]; then
  echo "no .$ext files under $corpus" >&2
  exit 2
fi

cd "$here"

start=$(date +%s.%N)
# --quiet suppresses the trees; the summary line per file still reports
# whether the parse succeeded. -s gives the per-file error counts.
output="$(tree-sitter parse --quiet --stat "${files[@]}" 2>&1)"
status=$?
end=$(date +%s.%N)

# tree-sitter reports a failing file with the position of the first
# error; count the files it names and the ERROR/MISSING nodes overall.
failed=$(printf '%s\n' "$output" | grep -c '(ERROR\|(MISSING\|ERROR \[' || true)

echo "$output" | tail -20
echo
echo "--- precondition measurement (.$ext) ---"
echo "files parsed:        ${#files[@]}"
echo "files with errors:   $failed"
printf 'wall time:           %.2fs\n' "$(echo "$end - $start" | bc)"
echo "tree-sitter exit:    $status"
echo
echo "zero error nodes over all files is the precondition"
echo "(ARCH dec:linter:kotlin-tree-sitter)"

exit $status
