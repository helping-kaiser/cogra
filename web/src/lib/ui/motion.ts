// The durations a component has to know in JavaScript, and nothing else.
//
// Motion belongs in CSS — `tokens-2.css` carries the durations, the easings and
// the nine transition classes. The one thing CSS cannot do is hold a native
// `<dialog>` open while its exit animation plays: `close()` removes the element
// from the top layer immediately, so the surface would vanish rather than leave
// the edge it entered from. That wait is what lives here.
//
// A reader who asked for stillness gets no wait either: with the animation
// zeroed there is nothing to wait for, and a 200ms stall before a sheet closes
// would read as the product being slow rather than calm.

/** `--duration-sheet-out` — a sheet goes back down the edge it came up. */
export const SHEET_OUT_MS = 200;

export function exitDuration(ms: number): number {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return ms;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}
