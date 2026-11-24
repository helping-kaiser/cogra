"use client";

// THE NAME'S TWO-LINE RULE (ProfileHeader.jsx `nameFitSize`; Profile.md:87;
// TagPage.md:9-11): a name that would take more than two lines at the title
// role's 22px on 28px takes the largest whole size from 22 down that holds
// two, its leading round(size × 28 / 22). The profile head has no smallest
// size; the tag page's heading passes a floor (jakob 2026-11-23: never below
// 12px), and a name that holds two lines at no size down to it stands at the
// floor on the lines it needs there. One rule, one fitter, two hosts.

import { useCallback, useRef, useState } from "react";

import { useMeasureEffect } from "./measure-effect";

/** The name's size and leading, in whole pixels. */
export type NameFit = { readonly size: number; readonly lineHeight: number };

/** The title-large role's own size and leading, where every name starts. */
const ROLE_SIZE = 22;
const ROLE_LEADING = 28;

const leadingAt = (size: number) => Math.round((size * ROLE_LEADING) / ROLE_SIZE);

/**
 * The largest whole-pixel size from 22 down, in steps of 1, at which the name
 * takes at most two lines, its leading round(size × 28 / 22) px, half up.
 * `lines` counts the name's lines at a size and leading. `floor` is the
 * smallest size (default 1, the profile head's: two lines are its hard cap).
 */
export function nameFitSize(lines: (size: number, lineHeight: number) => number, floor = 1): NameFit {
  for (let size = ROLE_SIZE; size > floor; size -= 1) {
    const lineHeight = leadingAt(size);
    if (lines(size, lineHeight) <= 2) return { size, lineHeight };
  }
  return { size: floor, lineHeight: leadingAt(floor) };
}

/**
 * The fitted size of a name heading, as `[holdName, fit]`: hand `holdName` to
 * the heading's `ref`; `fit` is null while the name holds two lines at the
 * role's own size, else the size the rule gives it. A heading that mounts
 * later (the tag page's, shown only once the header cuts the name) is
 * measured when it mounts, since the callback ref hands the element over.
 *
 * THE BROWSER COUNTS THE LINES. The heading is a block whose content height
 * is its lines times its leading, so each candidate size is set on it and its
 * height less its vertical padding read (MDN, `Element.getBoundingClientRect`,
 * `Window.getComputedStyle`), all before the paint (`useMeasureEffect`;
 * react.dev, *useLayoutEffect*: "measure layout before the browser repaints
 * the screen"), and the inline size it had is put back for React to render
 * the result. The fit follows the line's width (MDN, `ResizeObserver`) and the
 * web font's arrival (MDN, `FontFaceSet.ready`).
 */
export function useNameFit<T extends HTMLElement>(
  name: string,
  floor = 1,
): [holdName: (element: T | null) => void, fit: NameFit | null] {
  const elementRef = useRef<T | null>(null);
  // Each mount and unmount of the heading re-runs the measurement below.
  const [mounts, setMounts] = useState(0);
  const [fit, setFit] = useState<NameFit | null>(null);
  const holdName = useCallback((next: T | null) => {
    elementRef.current = next;
    setMounts((count) => count + 1);
  }, []);

  useMeasureEffect(() => {
    const element = elementRef.current;
    if (element === null) return;
    const measure = () => {
      const { fontSize, lineHeight } = element.style;
      const style = getComputedStyle(element);
      const inset = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      const next = nameFitSize((size, leading) => {
        element.style.fontSize = `${size}px`;
        element.style.lineHeight = `${leading}px`;
        return Math.round((element.getBoundingClientRect().height - inset) / leading);
      }, floor);
      element.style.fontSize = fontSize;
      element.style.lineHeight = lineHeight;
      setFit((previous) => {
        if (next.size === ROLE_SIZE) return null;
        return previous?.size === next.size && previous.lineHeight === next.lineHeight ? previous : next;
      });
    };
    measure();

    // Only a change of the line's WIDTH refits: the fit's own height change
    // is the observer's echo, never a reason to measure again.
    let width = element.getBoundingClientRect().width;
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const now = element.getBoundingClientRect().width;
            if (now === width) return;
            width = now;
            measure();
          });
    observer?.observe(element);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
      observer?.disconnect();
    };
  }, [name, mounts, floor]);

  return [holdName, fit];
}
