// Where travel across the bloomed pad lands in the value field.
//
// THE DRAWN FIELD IS THE VALUE SPACE (§8.3). The field is a soft rounded
// square, its corners are `(±1, ±1)`, and the knob never leaves the drawn
// shape — what the finger sees is what the value does. Nothing here maps
// a value outside the drawing, and nothing clamps by radius: §8.2 wants
// the whole square reachable, so each axis clamps on its own.
//
// Containment is STRUCTURAL rather than arithmetic. The knob's centre
// travels a box inset from the field, and the inset is the smallest one
// that keeps a knob of the drawn size inside the drawn corner — so a knob
// outside the field is not a bug this module can have. The inset is in
// pixels because both quantities it is built from are fixed design tokens
// (design.md §4): the field is responsive, its corner radius and its knob
// are not.
//
// The pick is ACCUMULATED TRAVEL from the point the pointer went down,
// not the pointer's absolute position in the field. The pad opens at the
// origin wherever the press landed, so the press point is the origin; an
// absolute mapping would jump the pick the instant the pad bloomed. One
// pixel of finger travel is one pixel of knob travel, which is what makes
// the drawn field readable as the value space at all.
//
// Horizontal is valence, vertical is connection (§8.3). Screen y grows
// downward and connection grows upward, so the vertical mapping inverts.

import { clampDimension, clampPair, ORIGIN, type StancePair } from "./model";

/**
 * The field's corner radius, in pixels — Material's `large` rung, which
 * `pad-geometry.test.ts` reads back out of `globals.css` so the constant
 * and the `rounded-large` the field wears cannot drift apart.
 */
export const FIELD_CORNER_RADIUS_PX = 16;

/** The knob's drawn diameter, in pixels — the `h-5 w-5` it is drawn at. */
export const KNOB_DIAMETER_PX = 20;

/**
 * How far the knob's centre stays clear of the field's edge so the knob
 * itself stays inside the drawn shape.
 *
 * A flat edge only asks for the knob's own radius. The rounded corner
 * asks for more: the corner's arc centre sits `r` in from both edges, the
 * inset travel box puts its own corner `√2·(r − inset)` away from that
 * arc centre, and the knob's rim reaches `k` further still. Requiring
 * that to stay within `r` is the second term. Where the corner is
 * gentler than the knob is wide the first term already covers it.
 */
export function knobTravelInset(
  cornerRadius: number = FIELD_CORNER_RADIUS_PX,
  knobDiameter: number = KNOB_DIAMETER_PX,
): number {
  const knobRadius = knobDiameter / 2;
  return Math.max(knobRadius, cornerRadius - (cornerRadius - knobRadius) / Math.SQRT2);
}

/** The inset the field is drawn with, evaluated once from the tokens. */
export const KNOB_TRAVEL_INSET_PX = knobTravelInset();

/** The pad's box in client coordinates — a DOMRect, or a test's stand-in. */
export type PadRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** Travel from the point the pointer went down, in pixels. */
export type PadTravel = { readonly dx: number; readonly dy: number };

/**
 * Half the span the knob's centre can travel, on the shorter side. This
 * is what one unit of either parameter measures, so finger and knob move
 * together. A field too small to hold the inset has no travel at all.
 */
export function padTravelHalfExtent(
  rect: PadRect,
  inset: number = knobTravelInset(),
): number {
  return Math.max(0, Math.min(rect.width, rect.height) / 2 - inset);
}

/**
 * The pair this much travel picks. A field with no travel in it — an
 * unlaid-out pad, or one smaller than its own knob — picks the origin
 * rather than dividing by zero.
 */
export function padPairFromTravel(
  rect: PadRect,
  travel: PadTravel,
  inset: number = knobTravelInset(),
): StancePair {
  return padPairFrom(ORIGIN, rect, travel, inset);
}

/**
 * The pair this much travel picks STARTING FROM `base`. The pad now
 * parks and stays open (§8.3), so a second drag on the field adjusts the
 * pick that is already standing rather than starting over — and it
 * adjusts it by the same accumulated travel the opening drag uses, so
 * there is one rule for how a finger moves the knob rather than two.
 *
 * A field with no travel in it — an unlaid-out pad, or one smaller than
 * its own knob — keeps the base rather than dividing by zero.
 */
export function padPairFrom(
  base: StancePair,
  rect: PadRect,
  travel: PadTravel,
  inset: number = knobTravelInset(),
): StancePair {
  const halfExtent = padTravelHalfExtent(rect, inset);
  if (halfExtent === 0) return clampPair(base);
  // Clamped once, on the sum: clamping the travel first would stop the
  // knob short whenever the base already sat off centre.
  return clampPair({
    pDirected: base.pDirected + travel.dx / halfExtent,
    pInterest: base.pInterest - travel.dy / halfExtent,
  });
}

/**
 * Where the knob for this pair sits, as a percentage of the TRAVEL BOX —
 * the inset box the component draws inside the field — so the component
 * positions it in CSS without re-measuring on resize. `(±1, ±1)` is that
 * box's corner, which is the field's corner with the knob tucked into it.
 */
export function padPercentOf(pair: StancePair): { readonly x: number; readonly y: number } {
  return {
    x: 50 + clampDimension(pair.pDirected) * 50,
    y: 50 - clampDimension(pair.pInterest) * 50,
  };
}
