// A LAYER THAT TAKES THE WHOLE SCREEN keeps its foot clear of the phone's own
// navigation bar.
//
// The web app opts into edge-to-edge (`viewportFit: "cover"`, layout.tsx), and
// from Chrome 135 Android lets such a viewport extend under the gesture or
// button navigation bar; a box at the bottom edge is then obstructed by it,
// and the cure Chrome documents is the safe-area inset (developer.chrome.com
// "Edge-to-edge on Android"). The bottom bar already pads itself by it
// (bottom-nav.tsx), the parked pad and the sheets lift by it; a full-screen
// layer — the comment editor, the reply wizard, the media viewer — pads its
// bottom by it, so its last control (`Sign the edit`) stands above the bar
// while the layer's ground still runs to the edge. With no inset the padding
// is zero and nothing moves. That diagnosis is the documented one for
// jakob's Chrome (≥ 137, Pixel 6, W49): it is not measured on a device yet.
//
// THE BOX ITSELF IS `inset: 0`. Measured on Chrome 133 (Pixel 6 emulator,
// address bar showing): a `fixed; inset: 0` box equals the visible band
// (786.29 px, the same as `100dvh`), as Chrome's own url-bar article says a
// fixed element fills exactly the visible height. A dynamic-viewport height
// would add nothing there, so the box keeps the plain fixed inset.

//
// ITS BOTTOM EDGE IS THE KEYBOARD'S TOP (`keyboard-inset.ts`): with the
// on-screen keyboard up the layer ends where the keyboard begins, so its
// pinned stack rides directly above it and the fields scroll in what is left
// (seam 381). With no keyboard the inset is 0 — `inset: 0` exactly.

/** The geometry every full-screen layer stands on: the whole screen above the keyboard, its foot above the system navigation bar. */
export const SCREEN_LAYER =
  "fixed inset-x-0 top-0 bottom-[var(--keyboard-inset,0px)] pb-[env(safe-area-inset-bottom)]";

/**
 * A PAGE THAT PINS ITS FOOT (a stage, the profile edit, a picker): the screen's
 * height less the keyboard, so its stack stands on the keyboard's top edge and
 * the fields scroll above it. `100dvh` with no keyboard — the height these
 * pages have always had.
 */
export const PINNED_PAGE = "h-[calc(100dvh_-_var(--keyboard-inset,0px))]";

/**
 * A STAGE WHOSE FOOT FOLLOWS ITS CONTENT ON A LONG PAGE (the compose wizard's
 * stages): the floor under it is the screen less the keyboard, so on a short
 * stage the foot still stands on the keyboard's top edge.
 */
export const PINNED_FLOOR = "min-h-[calc(100dvh_-_var(--keyboard-inset,0px))]";
