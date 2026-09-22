"use client";

// THE NARROW PHONE'S MENU HOLDS THE SHARE IT TOOK (design/readme.md, jakob
// 2026-09-17): at or under 360px of viewport width the affordance row sheds
// its Share control and the reader's overflow menu holds it instead — one
// number, one row that moves, no second design language.
//
// Measured the way `useAnchoredPlacement` measures a floating surface's
// anchor (`use-anchored.ts`): a layout effect reads `window.innerWidth` on
// mount, before the browser paints, and again on resize/orientation change.
// There is no established `useMediaQuery`/breakpoints module in this app to
// extend instead — this is the closest existing width-conditional idiom.

import { useState } from "react";
import { useMeasureEffect } from "./measure-effect";

/** The breakpoint itself — the ruling's one number. */
export const NARROW_SHARE_BREAKPOINT_PX = 360;

/** Whether the viewport is at or under the narrow-share breakpoint. */
export function useNarrowShare(): boolean {
  const [narrow, setNarrow] = useState(false);

  useMeasureEffect(() => {
    const measure = () => setNarrow(window.innerWidth <= NARROW_SHARE_BREAKPOINT_PX);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  return narrow;
}
