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

export function CollapsingTop({
  children,
  initiallyHidden = false,
}: {
  children: React.ReactNode;
  /** Whether the first paint should already show this region gone. */
  initiallyHidden?: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const host = useScrollHost();
  const [hidden, setHidden] = useState(initiallyHidden);
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
        if (Math.abs(delta) > 4) {
          const height = region.current?.offsetHeight ?? 0;
          const slotTop = sentinel.current?.getBoundingClientRect().top ?? 0;
          if (delta > 0) {
            upRun = 0;
            // Hide only scrolling down with half the slot off-screen.
            if (slotTop < -height / 2) setHidden(true);
          } else {
            upRun -= delta;
            if (upRun >= viewportHeightOf(host) / 3 || slotTop >= -height / 2) {
              setHidden(false);
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
    </>
  );
}
