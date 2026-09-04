#!/usr/bin/env bash
# Seed the fuzz corpora from the corpus this linter lints. The corpus/
# directory is gitignored (cargo-fuzz convention), so seeding is scripted
# rather than committed: run this once before a campaign.
#
#   bash seed.sh
#
# The seeds are the ones preview:lint:fuzz-plan names: the corpus's own
# Markdown and Rust files, the vector fixtures, and corpus-adoption.toml.
# The vector fixtures are written inline in the crate's tests/*.rs rather
# than as data files, so seeding the test sources is what carries them —
# every fixture string reaches the mutator as part of the file it lives in.
#
# - pretokenize_rust: every .rs file of the workspace, the crate's own
#   tests included.
# - scan_region: the .md files (prose syntax) and the .rs files (the acute
#   syntax lives in doc comments).
# - markdown_regions: every .md file of the corpus.
# - adoption_load: corpus-adoption.toml, plus every other .toml in the
#   tree so the mutator starts from more than one manifest shape.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
# Resolved, not "$here/../../..": the unresolved form still spells `/fuzz/`
# inside it, so every `-not -path '*/fuzz/*'` below would match the prefix
# and exclude the whole tree.
root="$(cd "$here/../../.." && pwd)"

mkdir -p "$here/corpus/pretokenize_rust" \
         "$here/corpus/scan_region" \
         "$here/corpus/markdown_regions" \
         "$here/corpus/adoption_load"

# Name seeds by content hash, as libfuzzer does: corpus paths are long and
# collide once flattened, and a hash keeps re-seeding idempotent.
copy_into() {
    local dest="$1"
    shift
    local n=0
    for f in "$@"; do
        [ -f "$f" ] || continue
        cp "$f" "$dest/$(sha1sum "$f" | cut -d' ' -f1)"
        n=$((n + 1))
    done
    echo "$n"
}

# A corpus that ended up empty is the failure this script exists to make
# impossible: the campaign after it finds nothing and reports a clean run,
# which is indistinguishable from a campaign that found nothing because
# there was nothing wrong. A mistyped or moved root fails here instead.
seed_into() {
    local target="$1" dest="$2"
    shift 2
    local n
    n="$(copy_into "$dest" "$@")"
    if [ "$n" -eq 0 ]; then
        echo "seed.sh: no seeds for $target — a campaign over an empty corpus reports nothing" >&2
        exit 1
    fi
    echo "seeded $n files -> $target"
}

# stderr is not suppressed: when a root is missing, find's own message is
# the only thing that says which one.
mapfile -t md < <(find "$root/docs" "$root/crates" "$root/android" "$root/web" \
    -name '*.md' -not -path '*/node_modules/*' -not -path '*/target/*')
mapfile -t rs < <(find "$root/crates" -name '*.rs' \
    -not -path '*/fuzz/*' -not -path '*/target/*')
mapfile -t toml < <(find "$root/crates" -name '*.toml' \
    -not -path '*/fuzz/*' -not -path '*/target/*')

for f in "$root"/*.md; do [ -f "$f" ] || continue; md+=("$f"); done

seed_into pretokenize_rust "$here/corpus/pretokenize_rust" "${rs[@]}"
seed_into scan_region "$here/corpus/scan_region" "${md[@]}" "${rs[@]}"
seed_into markdown_regions "$here/corpus/markdown_regions" "${md[@]}"
seed_into adoption_load "$here/corpus/adoption_load" \
    "$root/corpus-adoption.toml" "$root/Cargo.toml" "${toml[@]}"
