// The generated trees, declared once (the post-MVP separation, 2026-09-22).
//
// A tree is a directory holding `screens/`, the `.dc.html` boards rendered from
// them, `canvas.json` (the master layout), `graph.json` (the flow layer) and
// `canvases.json` (which canvas reviews which pages). Every stage below this
// file takes the tree as a parameter rather than naming one, so adding a tree
// is an entry here and nothing else.
//
// `designs/canonical` is the MVP baseline — the boards implementation reads
// from. `designs/postmvp` is where a round is drawn before its slice is
// current; a board moves across to canonical as a reviewed round when its
// slice becomes the work, and whatever implementation needs lands in canonical.
//
// The ideation canvases (`designs/search`, `designs/compose`, `designs/entry`,
// `designs/core-loop`) are deliberately absent. They render only when named by
// hand — `node render-screens.mjs designs/search` — which is what keeps a board
// frozen at the moment it was committed rather than following the masters.

export const TREES = ["designs/canonical", "designs/postmvp"];
