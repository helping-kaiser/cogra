#!/usr/bin/env bash
# Tag-round lane pipeline runner. Judged by the printed summary lines.
set -u
cd /mnt/d/dev/cogra_wt_taground/design/_build || exit 9
echo "=== bundle ==="   ; time node bundle.mjs
echo "=== render ==="   ; time node render-screens.mjs
echo "=== maps ==="     ; time node gen-maps.mjs
echo "=== flows ==="    ; time node check-flows.mjs
echo "=== done ==="
