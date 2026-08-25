"use client";

// Positions a floating surface against the element it belongs to, per
// `pad-placement.ts` (design.md §8.3). The pad and the coach mark both
// bloom from the same resting target and both have to stay on screen, so
// they share one measurement path rather than two that drift.
//
// The measurement is a LAYOUT effect: React runs it after the DOM is
// written and before the browser paints, so the corrected position is
// what gets painted and the caller's `hidden` first frame never reaches
// the screen. A plain effect would paint the unplaced surface first,
// which on a phone is a visible jump out of the corner of the viewport.
//
// Re-measuring on resize covers the on-screen keyboard and rotation,
// which change the viewport under an already-open surface.

import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

import { placePad, type PadPlacement } from "@/lib/stance/pad-placement";

/**
 * `useLayoutEffect` on the client, `useEffect` on the server. Next
 * prerenders client components, and React warns that a layout effect
 * cannot run there — correctly, since there is nothing to measure. The
 * branch is on the environment, not on a render, so the hook order is
 * the same every time either build runs.
 */
const useMeasureEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useAnchoredPlacement(
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  open: boolean,
): PadPlacement | null {
  const [placement, setPlacement] = useState<PadPlacement | null>(null);

  // The measurement lives inside the effect that uses it: it reads refs,
  // which the React Compiler cannot reason about across a memoized
  // boundary, and the effect is the only thing that ever calls it.
  useMeasureEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const measure = () => {
      const anchored = anchor.current;
      const surface = floating.current;
      if (anchored === null || surface === null) return;
      const target = anchored.getBoundingClientRect();
      const box = surface.getBoundingClientRect();
      setPlacement(
        placePad(
          { left: target.left, top: target.top, width: target.width, height: target.height },
          { width: box.width, height: box.height },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [open, anchor, floating]);

  return placement;
}

/** The style a floating surface wears: placed, or hidden until it is. */
export function anchoredStyle(placement: PadPlacement | null): CSSProperties {
  return placement === null
    ? { position: "fixed", left: 0, top: 0, visibility: "hidden" }
    : { position: "fixed", left: placement.left, top: placement.top };
}
