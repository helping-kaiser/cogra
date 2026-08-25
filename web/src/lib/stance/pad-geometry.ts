// Where travel across the bloomed pad lands in the value field.
//
// The field is drawn round; the VALUE SPACE IS THE SQUARE. The drawn
// radius is the full `[-1, +1]` range on each axis, so travel straight
// out reaches `±1` exactly at the drawn edge, and the corners — which
// sit at `√2` — are reached by carrying on past the edge along the
// diagonal. Values clamp per axis, never by radius: §8.2 requires the
// whole square to be reachable, and the control never refuses a choice.
//
// The pick is ACCUMULATED TRAVEL from the point the pointer went down,
// not the pointer's absolute position in the field. The pad opens at the
// origin under the thumb that opened it, so the thumb's own starting
// point is the origin; an absolute mapping would jump the pick the
// instant the pad bloomed.
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

/** Travel from the point the pointer went down, in pixels. */
export type PadTravel = { readonly dx: number; readonly dy: number };

export function padRadius(rect: PadRect): number {
  return Math.min(rect.width, rect.height) / 2;
}

/**
 * The pair this much travel picks. A zero-sized rect — an unlaid-out pad
 * — picks the origin rather than dividing by zero.
 */
export function padPairFromTravel(rect: PadRect, travel: PadTravel): StancePair {
  const radius = padRadius(rect);
  if (radius === 0) return { pDirected: 0, pInterest: 0 };
  return {
    pDirected: clampDimension(travel.dx / radius),
    pInterest: clampDimension(-travel.dy / radius),
  };
}

/**
 * Where the knob for this pair sits, as a percentage of the pad box, so
 * the component can position it in CSS without re-measuring on resize.
 * One unit of either parameter is the radius, which is half the box.
 */
export function padPercentOf(pair: StancePair): { readonly x: number; readonly y: number } {
  return {
    x: 50 + clampDimension(pair.pDirected) * 50,
    y: 50 - clampDimension(pair.pInterest) * 50,
  };
}
