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
// anything beneath can hear them. Nothing here changes when or how the surface
// closes; it only decides who hears the rest.
//
// IT TAKES ONLY WHAT IS PROVABLY THE SAME GESTURE'S, so it never eats a press
// it does not own. A `click`, `auxclick` or `contextmenu` is a PointerEvent
// naming the pointer that made it (Pointer Events 3, § "The click, auxclick and
// contextmenu events"); a keyboard's or a script's click names none of the
// pressed pointers. So the tail is taken when it names the dismissing pointer
// — or, in an engine whose click is still a plain MouseEvent, when it follows
// that pointer's lift within a second. Anything else ends the watch and passes
// untouched, as do the next press, a key, and the browser taking the pointer
// for a pan (`pointercancel`: no click follows one).

/** The events a dismissing press's gesture may still produce. */
const TAIL = ["pointerup", "pointercancel", "click", "auxclick", "contextmenu"] as const;

/** How long after the lift a click without a pointer id still counts as the gesture's. */
export const LEGACY_CLICK_WINDOW_MS = 1000;

/**
 * Keeps the rest of the gesture `down` began to itself: call it from the
 * `pointerdown` of the press that closes a surface. `down` is the native
 * event (React's `event.nativeEvent`).
 */
export function swallowRestOfGesture(down: Pick<PointerEvent, "pointerId">): void {
  if (typeof window === "undefined") return;
  const pointerId = down.pointerId;
  let liftedAt: number | null = null;

  const ours = (event: Event): boolean => {
    const id = (event as Partial<PointerEvent>).pointerId;
    if (typeof id === "number") return id === pointerId;
    return liftedAt !== null && Date.now() - liftedAt < LEGACY_CLICK_WINDOW_MS;
  };

  const take = (event: Event) => {
    if (event.type === "pointerup" || event.type === "pointercancel") {
      // A later finger's lift is its own gesture's.
      if ((event as PointerEvent).pointerId !== pointerId) return;
      if (event.type === "pointercancel") {
        stop();
        return;
      }
      liftedAt = Date.now();
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!ours(event)) {
      stop();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    // The click (or a long press's context menu) is the gesture's last word.
    if (event.type !== "auxclick") stop();
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
