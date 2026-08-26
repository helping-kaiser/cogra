#!/usr/bin/env bash
# Iterate `tree-sitter generate`, collecting the conflicts it reports
# into conflicts.json until the grammar generates.
#
# An authoring aid, not part of the grammar: the discovered list is
# reviewed, grouped and folded into grammar.js by hand, and this file's
# output is deleted afterwards.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

[ -f conflicts.json ] || echo '[]' > conflicts.json

for i in $(seq 1 400); do
  out="$(tree-sitter generate 2>&1)"
  if [ $? -eq 0 ]; then
    echo "generated after $((i - 1)) added conflicts"
    exit 0
  fi

  line="$(printf '%s\n' "$out" | grep -o 'Add a conflict for these rules: .*' | head -1)"
  if [ -z "$line" ]; then
    printf '%s\n' "$out" | tail -25
    echo "!! not a conflict error; stopping"
    exit 1
  fi

  # "Add a conflict for these rules: `a`, `b`" -> ["a","b"]
  rules="$(printf '%s\n' "$line" | grep -o '`[^`]*`' | tr -d '`')"
  json="$(printf '%s\n' "$rules" | node -e '
    const names = require("fs").readFileSync(0, "utf8").trim().split("\n");
    process.stdout.write(JSON.stringify(names));
  ')"

  node -e '
    const fs = require("fs");
    const list = JSON.parse(fs.readFileSync("conflicts.json", "utf8"));
    const added = JSON.parse(process.argv[1]);
    const key = JSON.stringify(added);
    if (list.some(e => JSON.stringify(e) === key)) {
      console.error("!! repeated conflict " + key + "; stopping");
      process.exit(1);
    }
    list.push(added);
    fs.writeFileSync("conflicts.json", JSON.stringify(list, null, 2) + "\n");
  ' "$json" || exit 1

  echo "added $json"
done

echo "!! iteration cap reached"
exit 1
