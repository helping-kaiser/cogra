"use client";

// The screen's collapsing top: the header (and the key banner when
// present) leaves with the flow scrolling down — but only once the
// region's own slot is fully scrolled past, so no gap opens near the
// top — and pins back the moment the reader scrolls up. The sentinel
// marks the region's natural position; a sticky element can't measure
// that itself once it is stuck.

import { useEffect, useRef, useState } from "react";

export function CollapsingTop({ children }: { children: React.ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (Math.abs(delta) > 4) {
          const height = region.current?.offsetHeight ?? 0;
          const slotTop = sentinel.current?.getBoundingClientRect().top ?? 0;
          // Hide only scrolling down with the whole slot off-screen.
          setHidden(delta > 0 && slotTop < -height);
          lastY = y;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <>
      <div ref={sentinel} aria-hidden />
      <div
        ref={region}
        data-testid="collapsing-top"
        className={`sticky top-0 z-20 flex flex-col gap-4 bg-surface pb-2 transition-transform duration-200 ${
          hidden ? "-translate-y-[110%]" : "translate-y-0"
        }`}
      >
        {children}
      </div>
    </>
  );
}
