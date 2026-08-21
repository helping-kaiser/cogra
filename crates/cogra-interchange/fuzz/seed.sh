#!/usr/bin/env bash
# Seed the fuzz corpora from the crate's checked-in test corpora. The
# corpus/ directory is gitignored (cargo-fuzz convention), so seeding is
# scripted rather than committed: run this once before a campaign.
#
#   bash seed.sh
#
# - decode_canonical / accept_document: every canonical RFC 8949 vector
#   from tests/corpus/rfc8949-vectors.json, written as raw bytes.
# - cddl_parse: the RFC 8610 Appendix H examples and the Appendix D
#   prelude, copied verbatim.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
corpora="$here/../tests/corpus"

mkdir -p "$here/corpus/decode_canonical" \
         "$here/corpus/accept_document" \
         "$here/corpus/cddl_parse"

python3 - "$corpora/rfc8949-vectors.json" \
          "$here/corpus/decode_canonical" \
          "$here/corpus/accept_document" <<'PY'
import hashlib, json, sys, pathlib

vectors, decode_dir, accept_dir = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.loads(pathlib.Path(vectors).read_text())
count = 0
for entry in data:
    if not entry.get("valid_canonical"):
        continue
    raw = bytes.fromhex(entry["hex"])
    # Name seeds by content hash, as libfuzzer does: some canonical
    # vectors are long byte strings whose hex overruns the filename cap.
    name = hashlib.sha1(raw).hexdigest()
    for d in (decode_dir, accept_dir):
        pathlib.Path(d, name).write_bytes(raw)
    count += 1
print(f"seeded {count} canonical vectors -> decode_canonical, accept_document")
PY

n=0
for f in "$corpora"/rfc8610-appendix-h/*.cddl "$corpora"/rfc8610-appendix-d-prelude.cddl; do
    [ -f "$f" ] || continue
    cp "$f" "$here/corpus/cddl_parse/"
    n=$((n + 1))
done
echo "seeded $n cddl files -> cddl_parse"
