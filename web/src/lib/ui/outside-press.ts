// A PRESS OUTSIDE ONLY EVER CLOSES (jakob's hand test, 2026-11-19: "the
// 'outside of popup click' must only ever close the popup and never count as
// a gesture to do something else as well"; PadStanding.md:17, "the surface
// beneath the pad's wash stays inert while the pad is up").
//
// WHY A SURFACE THAT CLOSES ON `pointerdown` LEAKS THE REST OF THE GESTURE.
// The wash is the press's target only while it stands. Closing on the press
// removes it, so the gesture's later events are hit-tested afresh and land on
// whatever lay beneath it: `pointerup`, then `click` (Pointer Events 3, §
// "The click, auxclick and contextmenu events": the click goes to the nearest
// common ancestor of the down and up targets, and a removed down target leaves
// the up target alone), or, for a long press, `contextmenu`. `preventDefault()`
// on the `pointerdown` cancels only the compatibility MOUSE events, never the
// click, which is not one of them (Pointer Events 3, § "Compatibility mapping
// with mouse events"). So a tap on the wash over a post's picture closed the
// pad AND opened the post.
//
// A modal `<dialog>` does not have this leak: its `::backdrop` belongs to the
// dialog, so every event of the gesture targets the dialog itself, and the
// dialogs here close on its `click` — the gesture's last event.
//
// THE CURE: the press that dismissed keeps the rest of its own gesture. A
// capture listener on the window — the first stop of every dispatch — takes
// that gesture's `pointerup`, `click`, `auxclick` and `contextmenu` before
// anything beneath can hear them. It stands down the moment the gesture is
// spent (its click taken), or when the next gesture or a key begins, so it can
// never eat a press it does not own. Nothing here changes when or how the
// surface closes; it only decides who hears the rest.

/** The events a dismissing press's gesture may still produce. */
const TAIL = ["pointerup", "click", "auxclick", "contextmenu"] as const;

/**
 * Keeps the rest of the gesture `down` began to itself: call it from the
 * `pointerdown` of the press that closes a surface. `down` is the native
 * event (React's `event.nativeEvent`).
 */
export function swallowRestOfGesture(down: Pick<PointerEvent, "pointerId">): void {
  if (typeof window === "undefined") return;
  const pointerId = down.pointerId;

  const take = (event: Event) => {
    // A later finger's lift is its own gesture's; only this pointer's is kept.
    if (event.type === "pointerup" && (event as PointerEvent).pointerId !== pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // The click (or a long press's context menu) is the gesture's last word.
    if (event.type === "click" || event.type === "contextmenu") stop();
  };
  // A new press or a key is a new gesture: nothing of it is ours.
  const release = () => stop();

  function stop() {
    for (const type of TAIL) window.removeEventListener(type, take, true);
    window.removeEventListener("pointerdown", release, true);
    window.removeEventListener("keydown", release, true);
  }

  for (const type of TAIL) window.addEventListener(type, take, true);
  // Added while this very `pointerdown` is dispatching: its capture phase at
  // the window has already run, so the press that called this never trips it.
  window.addEventListener("pointerdown", release, true);
  window.addEventListener("keydown", release, true);
}
