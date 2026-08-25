// Where the bloomed pad sits on screen (design.md §8.3).
//
// "The pad positions itself to be read, not under the press." It blooms
// anchored to the resting target, clamped fully inside the viewport, and
// offset so neither the field nor the readout above it sits under the
// finger or off-screen.
//
// Three rules, in this order:
//
//   1. CLEAR OF THE FINGER. The pad goes wholly above or wholly below the
//      resting target, separated by a gap. The finger is on the target,
//      so a pad that never overlaps the target is never under the finger
//      — and that is a property this module guarantees rather than a
//      layout that happens to work out.
//   2. INSIDE THE VIEWPORT. Above is preferred, because the finger and
//      the hand behind it occlude downward. Below is the fallback when
//      above does not fit, and where neither fits the roomier side is
//      taken and clamped.
//   3. CENTRED ON THE TARGET, then clamped horizontally. A pad hanging
//      off the side of a phone screen is the same failure as one hanging
//      off the top.
//
// Viewport coordinates, so the caller positions with `fixed`: the pad is
// open only while a pointer is held with scrolling suppressed, and fixed
// positioning cannot be clipped by an ancestor's overflow or shifted by
// an ancestor's transform the way an absolutely positioned popover can.

/** A box in viewport coordinates. */
export type PlacementRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type PlacementSize = {
  readonly width: number;
  readonly height: number;
};

export type PlacementViewport = {
  readonly width: number;
  readonly height: number;
};

export type PadPlacement = {
  readonly left: number;
  readonly top: number;
  /** Which side of the target the pad took — the caller points its tail. */
  readonly side: "above" | "below";
};

/** How much viewport edge is left visible around the pad. */
export const PAD_VIEWPORT_MARGIN_PX = 8;

/** The gap between the resting target and the pad, so neither touches. */
export const PAD_ANCHOR_GAP_PX = 8;

function clamp(value: number, low: number, high: number): number {
  // A pad larger than the space it is clamped into pins to the low edge:
  // an inverted range would otherwise put it off the near side instead.
  if (high < low) return low;
  return Math.min(high, Math.max(low, value));
}

export function placePad(
  anchor: PlacementRect,
  pad: PlacementSize,
  viewport: PlacementViewport,
  options: { readonly margin?: number; readonly gap?: number } = {},
): PadPlacement {
  const margin = options.margin ?? PAD_VIEWPORT_MARGIN_PX;
  const gap = options.gap ?? PAD_ANCHOR_GAP_PX;

  const roomAbove = anchor.top - gap - margin;
  const roomBelow = viewport.height - (anchor.top + anchor.height + gap) - margin;
  const side: PadPlacement["side"] =
    roomAbove >= pad.height ? "above" : roomBelow >= pad.height ? "below" : roomAbove >= roomBelow ? "above" : "below";

  const unclampedTop =
    side === "above" ? anchor.top - gap - pad.height : anchor.top + anchor.height + gap;
  const top = clamp(unclampedTop, margin, viewport.height - pad.height - margin);

  const centred = anchor.left + anchor.width / 2 - pad.width / 2;
  const left = clamp(centred, margin, viewport.width - pad.width - margin);

  return { left, top, side };
}
