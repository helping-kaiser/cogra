"use client";

// PULL DOWN AT THE TOP TO ASK AGAIN — the second of the two refresh routes the
// bottom bar's re-tap ladder rules for the feed.
//
// IT IS OURS TO IMPLEMENT BECAUSE THE DOCUMENT DOES NOT SCROLL. The browser's
// own pull-to-refresh is an overscroll of the ROOT scroller, and the app shell
// is a viewport-tall column whose middle scrolls (`shell.tsx`): the body is
// pinned and closed, so it has no overscroll to give and the platform gesture
// never fires. The same is true of every browser that ships no page-level
// gesture at all. So the gesture is read here, from the touch stream, on
// whichever element is the surface's scroller.
//
// THE THRESHOLD IS THE PLATFORM'S. 64dp is Material's own positional threshold
// for the pull-to-refresh gesture, which is what the Android app's
// `PullToRefreshBox` pulls against; the same number here keeps one gesture
// across the two apps.

import { useEffect, type RefObject } from "react";

import { scrollElementOf, scrollOffsetOf } from "./scroll-host";

/** Material's positional threshold for the gesture, in CSS pixels. */
export const PULL_THRESHOLD = 64;

/** A pull in progress: where the finger went down, and how far it has come. */
export type PullState = {
  /** The y the gesture started at, or null when no pull is running. */
  startY: number | null;
  travel: number;
};

export const NO_PULL: PullState = { startY: null, travel: 0 };

/** A finger goes down: only a touch that starts at the top can be a pull. */
export function pullStart(y: number, atTop: boolean): PullState {
  return atTop ? { startY: y, travel: 0 } : NO_PULL;
}

/**
 * The finger moves.
 *
 * A pull that turns upward is the reader scrolling into the list, and a list
 * that has moved off its top edge is being scrolled rather than pulled — both
 * end the gesture rather than waiting to see if it comes back, so a fling that
 * happens to end low cannot refresh.
 */
export function pullMove(state: PullState, y: number, atTop: boolean): PullState {
  if (state.startY === null) return NO_PULL;
  if (!atTop) return NO_PULL;
  const travel = y - state.startY;
  if (travel < 0) return NO_PULL;
  return { startY: state.startY, travel };
}

/** The finger lifts: far enough down is the ask. */
export function pullReleases(state: PullState): boolean {
  return state.startY !== null && state.travel >= PULL_THRESHOLD;
}

/** Read the pull gesture on the surface's own scroller. */
export function usePullToRefresh({
  host,
  onPull,
}: {
  host: RefObject<HTMLElement | null> | null;
  /** Called once per completed pull. Must be stable. */
  onPull: () => void;
}): void {
  useEffect(() => {
    const target: HTMLElement | Window = scrollElementOf(host) ?? window;
    let state = NO_PULL;
    const atTop = () => scrollOffsetOf(host) <= 0;
    const yOf = (event: Event) =>
      (event as TouchEvent).touches?.[0]?.clientY ?? (event as TouchEvent).changedTouches?.[0]?.clientY ?? 0;

    const onStart = (event: Event) => {
      state = pullStart(yOf(event), atTop());
    };
    const onMove = (event: Event) => {
      state = pullMove(state, yOf(event), atTop());
    };
    const onEnd = () => {
      const asked = pullReleases(state);
      state = NO_PULL;
      if (asked) onPull();
    };

    // Passive: the gesture is only READ. Nothing is dragged under the finger,
    // so there is no default to prevent and the browser keeps its fast path.
    target.addEventListener("touchstart", onStart, { passive: true });
    target.addEventListener("touchmove", onMove, { passive: true });
    target.addEventListener("touchend", onEnd, { passive: true });
    target.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      target.removeEventListener("touchstart", onStart);
      target.removeEventListener("touchmove", onMove);
      target.removeEventListener("touchend", onEnd);
      target.removeEventListener("touchcancel", onEnd);
    };
  }, [host, onPull]);
}
