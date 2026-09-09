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

import { useEffect, useRef, useState } from "react";

import { scrollOffsetOf, useScrollHost, viewportHeightOf } from "./scroll-host";

export function CollapsingTop({ children }: { children: React.ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const host = useScrollHost();
  const [hidden, setHidden] = useState(false);
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
    const target: HTMLElement | Window = host ?? window;
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
