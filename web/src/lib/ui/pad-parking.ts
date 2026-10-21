"use client";

// Where the bloomed pad sits (design.md §8.3; PadStanding.md: "the pad parks
// at the same spot every time, 16px above the bottom bar where the surface
// has one and 16px off the bottom edge where it does not, never anchored to
// the target").
//
// "The pad lives at one fixed spot: the lower centre of the viewport —
// the thumb-comfort zone — the same place every time, regardless of
// which control opened it. Muscle memory is part of the control; a pad
// that appears somewhere new on every press cannot be operated without
// looking."
//
// So the pad is not measured against anything. It is PARKED: fixed
// positioning, centred horizontally, held off the bottom edge. Nothing
// here reads a DOMRect, which is the point — an anchored surface has to
// re-measure on resize, rotation, and the on-screen keyboard, and each
// of those is a chance for the pad to move. A parked pad cannot move,
// because there is no measurement for a viewport change to invalidate.
//
// WHETHER A BAR STANDS IS THE SHELL'S TO SAY. The shell draws the bottom
// bar, so it says so through `PadParkingProvider`; the pad reads it and
// lifts itself clear of the bar, the master's `padInset` (16px above the
// 64px bar, plus the safe area the bar pads itself by).
//
// `pad-placement.ts` still anchors the COACH MARK, which §8.7 keeps
// against the target it teaches about.

import { createContext, useContext, type CSSProperties } from "react";

/** How far the pad's bottom edge sits above the viewport's, in pixels. */
export const PAD_PARK_INSET_PX = 16;

/** Above a bottom bar: the bar's 64px plus the same 16px (`padInset` 80). */
export const PAD_ABOVE_BAR_INSET_PX = 80;

/**
 * The parked pad's style. `bottom` rather than `top` is what makes it the
 * LOWER centre on any viewport height without arithmetic. It is centred by
 * `left: 0; right: 0; margin-inline: auto` around a width the caller owns,
 * not by a translate, so the pad's bloom — the dialog's 8px rise (readme §4,
 * the motion table) — owns `transform` without fighting the parking for it.
 *
 * `aboveBar` adds the safe-area inset the bar pads itself by, so the pad
 * clears the bar on a phone with a home indicator too.
 *
 * The height cap is the one concession to small viewports: a pad taller
 * than the screen would otherwise run off the top, where the parking
 * rule has nothing to say. It scrolls inside itself instead of moving.
 */
export function parkedPadStyle(
  inset: number = PAD_PARK_INSET_PX,
  aboveBar: boolean = false,
): CSSProperties {
  const bottom = aboveBar ? `calc(${inset}px + env(safe-area-inset-bottom, 0px))` : `${inset}px`;
  return {
    position: "fixed",
    left: 0,
    right: 0,
    marginInline: "auto",
    bottom,
    maxHeight: `calc(100dvh - ${inset * 2}px)`,
  };
}

const BarContext = createContext(false);

/** The shell says whether its bottom bar stands under the page. */
export const PadParkingProvider = BarContext.Provider;

/** Whether a bottom bar stands under the page the pad blooms over. */
export function useBarBeneath(): boolean {
  return useContext(BarContext);
}
