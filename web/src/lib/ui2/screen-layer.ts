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

//
// WHICH SURFACES RIDE (jakob's ruling, design → impl seam 388): with the
// keyboard up the field being typed in comes first. A surface with ONE field
// lets its pinned commit ride directly above the keyboard (the `*` constants
// below); a surface with SEVERAL fields keeps its foot where it is, under the
// keyboard, and the focused field takes the room (the `*_STILL` twins) — a
// commit right above the keyboard on a page of fields invites an accidental
// submit. Each consumer names its class and why (`keyboard-reach.test.ts`).
// With no keyboard every twin is the same box as its riding constant.

/** Which way a pinned surface meets the on-screen keyboard (seam 388). */
export type KeyboardClass = "rides" | "stays";

/** The geometry every full-screen layer stands on: the whole screen above the keyboard, its foot above the system navigation bar. */
export const SCREEN_LAYER =
  "fixed inset-x-0 top-0 bottom-[var(--keyboard-inset,0px)] pb-[env(safe-area-inset-bottom)]";

/** A full-screen layer of SEVERAL fields: the whole screen, the keyboard over its foot. */
export const SCREEN_LAYER_STILL = "fixed inset-0 pb-[env(safe-area-inset-bottom)]";

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

/** A pinned page of SEVERAL fields: the screen's height; the keyboard covers its foot. */
export const PINNED_PAGE_STILL = "h-dvh";

/** A stage of SEVERAL fields whose foot follows its content: the screen's height as its floor. */
export const PINNED_FLOOR_STILL = "min-h-dvh";

/**
 * THE FIELD WINS WHEN ROOM IS SHORT (seam 388, point 1): a riding surface's
 * growing field never goes below three of its lines. It is a floor on the
 * box, not a measurement: where the band left above the keyboard cannot hold
 * the chrome, three lines and the commit, the column overflows and the commit
 * falls below the band — under the keyboard — while the field keeps its
 * lines. `lh` is the box's own line height (MDN, CSS `<length>`); the sum
 * after it is the box's padding and border, as each field spells them.
 */
export const FIELD_FIRST_LINES = 3;
