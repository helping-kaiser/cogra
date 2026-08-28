#!/bin/bash
# Migrate the dev database and regenerate the committed .sqlx/ offline
# metadata for the queries this lane added.
set -uo pipefail
export CARGO_TARGET_DIR="$HOME/targets/cogra-lane-a"
cd /mnt/c/Users/peerp/dev/cogra/.claude/worktrees/agent-ac4ca7bd682a4a524 || exit 2
set -a
. ./.env
set +a

echo "==== migrate ===="
sqlx migrate run --source migrations --database-url "$DATABASE_URL" || exit 1

echo "==== sqlx prepare ===="
cargo sqlx prepare --workspace --database-url "$DATABASE_URL" || exit 1
echo "==== done ===="
