"use client";

// LANDING AT THE HARD TOP — the moment a scroll surface comes to rest where it
// cannot scroll further up (tmp_dev packet `web-stage-law.md` §3.2 rule 6,
// RF-5). The stage law re-elects there: "WHEN scroll settles at the feed's
// hard top … the stage re-elects to the first qualifying clip in feed order"
// (Feed.md:19), and "WHEN an overscroll bounce settles back at the feed's hard
// top" likewise (Feed.md:21) — the thread, the topic page and the profile's
// posts each at their own hard top (ReplyEntry.md:3/5, TagPage.md:25/27,
// ProfilePosts.md:7/9).
//
// IT IS AN EDGE, NOT A STATE. Android's rule, which the web shares: the
// election fires on the edge into "at rest at the top", never while resting
// there (`ScrollStage.kt`, PR #21) — so an unveil while resting at the top
// steals nothing. Two things put the surface back at rest at its top:
//
// - `scrollend` with the offset at or above 0. A browser fires it once a
//   scroll that MOVED something has finished
//   (https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event),
//   which covers a fling, a programmatic scroll, keys and the wheel, and iOS's
//   rubber band settling back. A gesture that moves nothing fires nothing, so
//   a wheel tick or Home at the top lands nowhere (GAP-12, answered by the law).
// - the release of the app's own pull at the top (`pull-to-refresh.ts`): a
//   drag the scroller could not consume, which is android's
//   `anOverscrollAtTheHardTopSettlingBackCountsAsTheHardTop`.
//
// Leaving the rest is any scroll that takes the offset past 0, or a pull that
// starts to travel. Only a landing from there counts — which is also what
// keeps a rubber band that is both a pull and a scroll from landing twice.
//
// Behaviour-neutral on its own: nothing listens for a landing until the stage
// host does (the election PR).

import { useEffect, useEffectEvent, type RefObject } from "react";

import { NO_PULL, pullMove, pullStart } from "./pull-to-refresh";
import { scrollElementOf, scrollOffsetOf } from "./scroll-host";

/** Hear the surface land at its hard top. */
export function useHardTopLanding({
  host,
  onLand,
  enabled = true,
}: {
  /** The surface's scroller, as `useScrollHost` hands it; null means the window. */
  host: RefObject<HTMLElement | null> | null;
  /** Called once per landing. Always the latest one — it need not be stable. */
  onLand: () => void;
  enabled?: boolean;
}): void {
  const land = useEffectEvent(onLand);

  useEffect(() => {
    if (!enabled) return;
    const target: HTMLElement | Window = scrollElementOf(host) ?? window;
    const atTop = () => scrollOffsetOf(host) <= 0;
    const yOf = (event: Event) =>
      (event as TouchEvent).touches?.[0]?.clientY ??
      (event as TouchEvent).changedTouches?.[0]?.clientY ??
      0;

    // Where the surface starts is where it is: arriving at the top is not a
    // landing, any more than resting there is.
    let resting = atTop();
    let pull = NO_PULL;

    const arrive = () => {
      if (resting || !atTop()) return;
      resting = true;
      land();
    };

    const onScroll = () => {
      if (!atTop()) resting = false;
    };
    const onScrollEnd = () => arrive();
    const onTouchStart = (event: Event) => {
      pull = pullStart(yOf(event), atTop());
    };
    const onTouchMove = (event: Event) => {
      pull = pullMove(pull, yOf(event), atTop());
      if (pull.travel > 0) resting = false;
    };
    const onTouchEnd = () => {
      const pulled = pull.startY !== null && pull.travel > 0;
      pull = NO_PULL;
      if (pulled) arrive();
    };

    // Passive, like the pull's own listeners: the gesture is only read.
    target.addEventListener("scroll", onScroll, { passive: true });
    target.addEventListener("scrollend", onScrollEnd, { passive: true });
    target.addEventListener("touchstart", onTouchStart, { passive: true });
    target.addEventListener("touchmove", onTouchMove, { passive: true });
    target.addEventListener("touchend", onTouchEnd, { passive: true });
    target.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      target.removeEventListener("scrollend", onScrollEnd);
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [host, enabled]);
}
