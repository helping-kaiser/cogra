"use client";

// Pins its child to the viewport top the moment the reader scrolls
// up, and lets it slide away scrolling down — a must-act banner
// stays reachable without a trip back to the top of the page.
// Sticky positioning keeps the element's slot in the flow; the
// direction hook only toggles a translate.

import { useEffect, useRef, useState } from "react";

function useScrollingUp(): boolean {
  const [up, setUp] = useState(true);
  const lastY = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // A few px of slack so sub-pixel jitter doesn't flip it.
        if (Math.abs(y - lastY.current) > 4) {
          setUp(y < lastY.current || y <= 0);
          lastY.current = y;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return up;
}

export function StickyReveal({ children }: { children: React.ReactNode }) {
  const up = useScrollingUp();
  return (
    <div
      data-testid="sticky-reveal"
      className={`sticky top-2 z-20 transition-transform duration-200 ${
        up ? "translate-y-0" : "-translate-y-[130%]"
      }`}
    >
      {children}
    </div>
  );
}
