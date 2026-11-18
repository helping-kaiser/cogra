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

/** The geometry every full-screen layer stands on: the whole screen, its foot above the system navigation bar. */
export const SCREEN_LAYER = "fixed inset-0 pb-[env(safe-area-inset-bottom)]";
