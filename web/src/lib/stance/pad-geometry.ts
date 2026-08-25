// Where a point in the bloomed pad lands in the value field, and back.
//
// design.md §8.3 blooms a *circular* pad; §8.2 requires the *whole
// square* to be reachable, corners included — the control never prevents
// a choice. Both hold at once when the value square is the one inscribed
// in the circle: its corners `(±1, ±1)` sit exactly on the circle at the
// diagonals, and every other pair sits inside it. So the field half-side
// is `radius / √2`, and a drag past it clamps per axis rather than being
// refused.
//
// Horizontal is valence, vertical is connection (§8.3). Screen y grows
// downward and connection grows upward, so the vertical mapping inverts.

import { clampDimension, type StancePair } from "./model";

/** The pad's box in client coordinates — a DOMRect, or a test's stand-in. */
export type PadRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** Offset from the pad's centre, in pixels. */
export type PadOffset = { readonly x: number; readonly y: number };

export function padRadius(rect: PadRect): number {
  return Math.min(rect.width, rect.height) / 2;
}

/** Pixels per unit of either parameter — the inscribed square's half-side. */
function fieldHalfSide(rect: PadRect): number {
  return padRadius(rect) / Math.SQRT2;
}

function padCentre(rect: PadRect): PadOffset {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * The pair a pointer at these client coordinates picks. A zero-sized rect
 * — an unlaid-out pad — picks the origin rather than dividing by zero.
 */
export function padPairAt(rect: PadRect, clientX: number, clientY: number): StancePair {
  const half = fieldHalfSide(rect);
  if (half === 0) return { pDirected: 0, pInterest: 0 };
  const centre = padCentre(rect);
  return {
    pDirected: clampDimension((clientX - centre.x) / half),
    pInterest: clampDimension((centre.y - clientY) / half),
  };
}

/** Where the knob for this pair sits, as an offset from the pad's centre. */
export function padOffsetOf(rect: PadRect, pair: StancePair): PadOffset {
  const half = fieldHalfSide(rect);
  return {
    x: clampDimension(pair.pDirected) * half,
    y: -clampDimension(pair.pInterest) * half,
  };
}

/**
 * The same offset as a percentage of the pad box, so the knob can be
 * positioned in CSS without the component re-measuring on every resize.
 */
export function padPercentOf(pair: StancePair): PadOffset {
  // The inscribed square spans `2 * radius / √2` of a `2 * radius` box:
  // one unit of either parameter is 100 / (2√2) percent of the box.
  const perUnit = 100 / (2 * Math.SQRT2);
  return {
    x: 50 + clampDimension(pair.pDirected) * perUnit,
    y: 50 - clampDimension(pair.pInterest) * perUnit,
  };
}
