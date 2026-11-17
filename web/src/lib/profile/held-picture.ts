// The picture the head's change badge picked, held for the one screen that
// takes it: the picture's own flow (`/profile/picture`, AvatarCrop → AvatarSeal).
//
// WHY A HAND-OVER AND NOT A URL. On the web the picker is the browser's own
// file dialog, and a `File` cannot ride a route: it is a handle into this
// tab's memory, never data a URL may carry (and a picture's bytes are nobody
// else's business). The badge's tap must open the dialog itself — a browser
// opens a file dialog only from a user's gesture — so the pick happens on the
// profile and the flow's route reads it from here. A route arrived at with
// nothing held (a reload, a typed address) has no picture to frame and goes
// back to the profile.
//
// The flow RELEASES the pick through its own ways out rather than taking it
// on arrival: React runs a state initialiser twice in development's strict
// mode, and a take-once read would hand the second run nothing.

let held: File | null = null;

/** Holds the badge's pick for the flow that is about to open. */
export function holdPicture(file: File): void {
  held = file;
}

/** The held pick; null when nothing was picked or the flow was left. */
export function heldPicture(): File | null {
  return held;
}

/** The flow was left: the pick is nobody's any more. */
export function releaseHeldPicture(): void {
  held = null;
}
