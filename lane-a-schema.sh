#!/bin/bash
# Re-export the frontend contract from the Rust schema.
set -uo pipefail
export CARGO_TARGET_DIR="$HOME/targets/cogra-lane-a"
export SQLX_OFFLINE=true
cd /mnt/c/Users/peerp/dev/cogra/.claude/worktrees/agent-ac4ca7bd682a4a524 || exit 2
find crates -name '*.rs' -exec touch {} +
cargo run -p api --bin export-schema > schema.graphql
code=$?
echo "---- export exit ${code}, $(wc -l < schema.graphql) lines ----"
exit $code
