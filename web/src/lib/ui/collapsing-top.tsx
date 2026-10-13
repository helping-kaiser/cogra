"use client";

// The screen's collapsing top: the header (and the key banner when
// present) leaves with the flow scrolling down — but only once half
// the region's own slot is scrolled past; the exit transition and the
// scroll itself cover the rest of the slot — and returns only after
// about a third of a screen of accumulated upward scroll, so a short
// correction toward a post's top summons nothing. Any downward scroll
// resets the tally, and the region always pins back once its own slot
// returns to view — a hidden sticky region with its slot on-screen
// would leave a hole. The sentinel marks the region's natural
// position; a sticky element can't measure that itself once stuck.
//
// IT FOLLOWS THE SHELL'S SCROLLER, NOT THE WINDOW. The app frame is a
// viewport-tall column whose middle scrolls (`shell.tsx`), so the window never
// moves under a reading surface and a window listener would never fire. With
// no shell above it — a component rendered alone, or a test — the window IS
// the scroller, and it listens there instead.
//
// A CALLER THAT RESTORES A SCROLLED PLACE OWNS THE FIRST FRAME TOO. `hidden`
// used to always start `false` and wait for a scroll event to correct it —
// but a place restored by `scroll-pin.ts` lands before paint, imperatively,
// and fires no synchronous event a layout effect here could catch (a child's
// layout effect runs before its parent's, so by the time this component could
// read the scroller it would still be reading the pre-restore offset). Sticky
// positioning then paints this region pinned at the top regardless, one frame
// before the real scroll listener below gets a chance to hide it — the flash.
// `initiallyHidden` lets a caller who already knows the restored offset
// synchronously (the same lazy-read source the restore itself used) seed the
// state so the first paint is already correct, same technique as `next`'s own
// guide for syncing React state with a pre-paint correction
// (`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`,
// "Syncing with React state").

import { useEffect, useRef, useState } from "react";

import { scrollElementOf, scrollOffsetOf, useScrollHost, viewportHeightOf } from "./scroll-host";

/**
 * How deep a reader must be, in screenfuls, before the band they summon brings
 * the way back up with it (FeedScrolled.md:3-5): three viewport-heights, never
 * shallower.
 */
export const BACK_TO_TOP_DEPTH = 3;

export function CollapsingTop({
  children,
  initiallyHidden = false,
  onBackToTop,
}: {
  children: React.ReactNode;
  /** Whether the first paint should already show this region gone. */
  initiallyHidden?: boolean;
  /**
   * THE BACK TO TOP PILL (FeedScrolled.md; `BackToTop.jsx`), for the surface
   * that has one — the feed. The pill rides in with the band when the reader
   * summons it from three screens down or deeper, centred directly under it,
   * and leaves under it. This is what the tap does.
   */
  onBackToTop?: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const host = useScrollHost();
  const [hidden, setHidden] = useState(initiallyHidden);
  // Whether the band, as it stands, was summoned from deep enough to bring the
  // pill: decided at the summoning and kept until the band leaves or the list
  // is back at its hard top, where there is nothing left to go back up to.
  const [summonedDeep, setSummonedDeep] = useState(false);
  // Where the band ends, measured as it returns: the pill sits directly under.
  const [bandBottom, setBandBottom] = useState(0);
  useEffect(() => {
    let lastY = scrollOffsetOf(host);
    let upRun = 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = scrollOffsetOf(host);
        const delta = y - lastY;
        if (y <= 0) setSummonedDeep(false);
        if (Math.abs(delta) > 4) {
          const height = region.current?.offsetHeight ?? 0;
          const slotTop = sentinel.current?.getBoundingClientRect().top ?? 0;
          if (delta > 0) {
            upRun = 0;
            // Hide only scrolling down with half the slot off-screen.
            if (slotTop < -height / 2) {
              setHidden(true);
              setSummonedDeep(false);
            }
          } else {
            upRun -= delta;
            const viewport = viewportHeightOf(host);
            if (slotTop >= -height / 2) {
              setHidden(false);
              setSummonedDeep(false);
            } else if (upRun >= viewport / 3) {
              setHidden(false);
              setSummonedDeep((deep) => deep || y >= BACK_TO_TOP_DEPTH * viewport);
              setBandBottom((scrollElementOf(host)?.getBoundingClientRect().top ?? 0) + height);
            }
          }
          lastY = y;
        }
        ticking = false;
      });
    };
    const target: HTMLElement | Window = scrollElementOf(host) ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [host]);
  return (
    <>
      <div ref={sentinel} aria-hidden />
      <div
        ref={region}
        data-testid="collapsing-top"
        // The duration is the token, not a literal, so a reader who asked for
        // stillness is answered by `tokens-2.css` zeroing it rather than by
        // this component remembering to ask.
        className={`sticky top-0 z-20 flex flex-col gap-4 bg-surface pb-2 transition-transform duration-[var(--duration-collapsing-top)] ${
          hidden ? "-translate-y-[110%]" : "translate-y-0"
        }`}
      >
        {children}
      </div>
      {onBackToTop !== undefined && (
        <BackToTop
          shown={!hidden && summonedDeep}
          top={bandBottom}
          onPress={onBackToTop}
        />
      )}
    </>
  );
}

/**
 * THE PILL, FIXED UNDER THE BAND AND NEVER INSIDE IT (`BackToTop.jsx`): the
 * region hides once half its own slot has scrolled past, so anything added to
 * it would move that threshold and re-clamp the list (item 45.3). Fixed, it
 * takes no layout space, and the band's collapse point stays where it is
 * (FeedScrolled.md:9).
 *
 * IT SLIDES UNDER THE BAND, never over it: one rung below the region (19
 * against 20), on the band's own duration, so what leaves and what it leaves
 * behind move as one thing (:7). Plain words on the tonal ground — it commits
 * nothing, so it is not `primary`.
 */
function BackToTop({ shown, top, onPress }: { shown: boolean; top: number; onPress: () => void }) {
  return (
    <div
      data-testid="back-to-top"
      data-shown={shown}
      inert={!shown}
      className="pointer-events-none fixed inset-x-0 z-[19] flex justify-center transition-transform duration-[var(--duration-collapsing-top)]"
      style={{
        top,
        transform: shown ? "translateY(0)" : `translateY(calc(-100% - ${top}px))`,
      }}
    >
      <button
        type="button"
        data-testid="back-to-top-pill"
        onClick={onPress}
        className="cg-state cg-focus cg-hit pointer-events-auto inline-flex min-h-8 min-w-16 items-center justify-center whitespace-nowrap rounded-full bg-surface-container-highest px-4 py-1.5 text-label-large text-on-surface"
      >
        Back to top
      </button>
    </div>
  );
}
