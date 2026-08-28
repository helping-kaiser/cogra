#!/bin/bash
# Lane A build/test driver. Inline scripts do not survive the trip through
# wsl.exe, so every non-trivial command lives here and is run as a file.
set -uo pipefail
export CARGO_TARGET_DIR="$HOME/targets/cogra-lane-a"
cd /mnt/c/Users/peerp/dev/cogra/.claude/worktrees/agent-ac4ca7bd682a4a524 || exit 2

start=$(date +%s)
"$@"
code=$?
end=$(date +%s)
echo "---- lane-a: exit ${code} in $((end - start))s: $* ----"
exit $code
