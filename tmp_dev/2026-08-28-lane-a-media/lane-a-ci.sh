#!/bin/bash
# The full local CI surface, timed per stage. Exit codes are captured
# from the commands themselves, never from a pipe's tail.
set -uo pipefail
export CARGO_TARGET_DIR="$HOME/targets/cogra-lane-a"
cd /mnt/c/Users/peerp/dev/cogra/.claude/worktrees/agent-ac4ca7bd682a4a524 || exit 2
set -a
. ./.env 2>/dev/null
set +a

failed=0
stage() {
    local name="$1"; shift
    local start end code
    start=$(date +%s)
    "$@" > "/tmp/lane-a-${name}.log" 2>&1
    code=$?
    end=$(date +%s)
    printf '%-16s exit %-3s %4ss\n' "$name" "$code" "$((end - start))"
    if [ $code -ne 0 ]; then
        failed=1
        echo "----- ${name} tail -----"
        tail -30 "/tmp/lane-a-${name}.log"
        echo "------------------------"
    fi
}

stage fmt cargo fmt --all -- --check
stage clippy env SQLX_OFFLINE=true cargo clippy --all-targets --all-features -- -D warnings
stage lint-corpus env SQLX_OFFLINE=true cargo run -q -p cogra-linter --bin cogra-lint -- check
stage sqlx-check cargo sqlx prepare --workspace --check --database-url "$DATABASE_URL"
stage test env SQLX_OFFLINE=true cargo test --all
stage docs-links lychee --offline --include-fragments --no-progress 'docs/**/*.md' '*.md' 'android/*.md' 'web/*.md'

echo "==== lane-a ci: $([ $failed -eq 0 ] && echo GREEN || echo RED) ===="
exit $failed
