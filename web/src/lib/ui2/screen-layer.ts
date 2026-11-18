// A LAYER THAT TAKES THE WHOLE SCREEN is as tall as the VISIBLE viewport.
//
// `position: fixed; inset: 0` lays a box out against the LAYOUT viewport, and
// a phone browser's layout viewport is taller than the visible one while its
// address bar shows (shell.tsx, layout.tsx: the same mechanism once pushed
// the bottom bar off a long post). A full-screen layer whose foot sits at its
// bottom then puts that foot under the browser's own toolbar, out of reach,
// with nothing to scroll — jakob's Pixel 6 (2026-11-18, W49): the comment
// editor's `Sign the edit` stood half off the screen. `100dvh` is the unit
// that tracks the address bar (CSS Values 4, "dynamic viewport"), so the
// layer is pinned to the top and takes exactly that height.

/** The geometry every full-screen layer stands on: top-pinned, full width, the dynamic viewport's height. */
export const SCREEN_LAYER = "fixed inset-x-0 top-0 h-dvh";
