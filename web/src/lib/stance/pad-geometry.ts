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

import { clampDimension, clampPair, ORIGIN, snapPair, type StancePair } from "./model";

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
 * THE SAME TRAVEL RULE WITH ONE AXIS IN IT — the one-axis strip an
 * author's backing of their own post is picked on (`AttachmentPad`).
 *
 * Half the span the knob's centre can travel, measured across the strip
 * rather than on its shorter side: a line has no second axis to be
 * limited by, and taking the minimum would scale the whole pick to the
 * strip's height.
 */
export function valenceTravelHalfExtent(rect: PadRect, inset: number): number {
  return Math.max(0, rect.width / 2 - inset);
}

/** The zero detent's reach: the knob's own radius (`ATTACHMENT_DETENT_PX`, 10px). */
export const ATTACHMENT_DETENT_PX = KNOB_DIAMETER_PX / 2;

/**
 * The value this much horizontal travel picks STARTING FROM `base`, by
 * the same accumulated-travel rule the square uses — so one pad's finger
 * and the other's move their knobs alike. Clamped once, on the sum; a
 * field with no travel in it keeps the base rather than dividing by zero.
 *
 * THE ZERO HAIRLINE IS A DETENT (jakob 2026-10-20; the master's
 * `attachmentFrom`, built in round 20 as the reference the clients conform
 * to): while the travel would put the knob's centre within the knob's own
 * radius of the hairline, the knob holds ON it and the pick reads exactly
 * 0.00 — `No side yet` is a place a drag rests on purpose.
 */
export function valenceFrom(
  base: number,
  rect: PadRect,
  dx: number,
  inset: number,
): number {
  const halfExtent = valenceTravelHalfExtent(rect, inset);
  if (halfExtent === 0) return clampDimension(base);
  const raw = clampDimension(base + dx / halfExtent);
  // One unit of the axis is `halfExtent` pixels of travel, so the knob's
  // centre stands |raw| × halfExtent px from the hairline.
  return Math.abs(raw) * halfExtent <= ATTACHMENT_DETENT_PX ? 0 : raw;
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

// ── THE FIELD WITH A BOUND PER SLOT ─────────────────────────────────────────
//
// THE CONTROL OWNS THE GEOMETRY, THE CENSUS OWNS HOW FAR EACH SLOT REACHES
// (`design/components/stance/StancePad.jsx`, `ranges`). A stance fills the
// whole signed square; a tag's pair does not — confidence is census-bounded to
// `[0, 1]` (hashtag.md §4) and the composer authors only claims, so relevance
// starts just above nothing (`TAG_RANGES`). The square is then the REACHABLE
// square, corner to corner, rather than a signed square with half of it dead.
//
// Everything above stays the stance square's own and is unchanged; these are
// the master's ranged forms, and at `STANCE_RANGES` they pick and place exactly
// what `padPairFrom` and `padPercentOf` do.

/** How far one slot reaches. */
export type AxisRange = { readonly min: number; readonly max: number };

/** The reach of both slots — relevance/valence across, the other up. */
export type PadRanges = { readonly pDirected: AxisRange; readonly pInterest: AxisRange };

/** A stance's square: both slots over the full signed Dimension. */
export const STANCE_RANGES: PadRanges = {
  pDirected: { min: -1, max: 1 },
  pInterest: { min: -1, max: 1 },
};

/**
 * THE TAG FIELD STARTS JUST ABOVE NOTHING (`StanceReadout.jsx`, jakob's ruling
 * 2026-09-11). The withdrawal is the un-tag, its own act at (0,0), never
 * the far end of a drag — so the field carries claims only and floors here.
 */
export const TAG_RELEVANCE_FLOOR = 0.01;

/** A tag's pair: relevance from the floor to 1 across, confidence 0 to 1 up. */
export const TAG_RANGES: PadRanges = {
  pDirected: { min: TAG_RELEVANCE_FLOOR, max: 1 },
  pInterest: { min: 0, max: 1 },
};

function clampTo(value: number, range: AxisRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}

/** The pair held inside the field's reach, each slot on its own. */
export function clampToRanges(pair: StancePair, ranges: PadRanges): StancePair {
  return {
    pDirected: clampTo(pair.pDirected, ranges.pDirected),
    pInterest: clampTo(pair.pInterest, ranges.pInterest),
  };
}

/**
 * The pair a release lands on: the hundredths grid, then the field's reach.
 * Every range's ends are themselves hundredths, so clamping after the snap
 * keeps the pair on the grid — a tag's relevance a drag carried to 0.004
 * lands on its +0.01 floor, never on the withdrawal at 0.
 */
export function snapToRanges(pair: StancePair, ranges: PadRanges): StancePair {
  return clampToRanges(snapPair(pair), ranges);
}

/** How much one pixel of travel is worth on a slot that spans `range`. */
function perPixel(range: AxisRange, halfExtent: number): number {
  return (range.max - range.min) / (2 * halfExtent);
}

/** Where a value sits on its slot: 0 at the range's low end, 1 at its high end. */
function fractionOf(value: number, range: AxisRange): number {
  return (value - range.min) / (range.max - range.min);
}

/**
 * A percentage rounded before it reaches a style, the master's rule: binary
 * floating point makes one position come out as 55 or 55.00000000000001
 * depending on operation order, and six decimals is far below a device pixel.
 */
function percent(fraction: number): number {
  return Math.round(fraction * 1e8) / 1e6;
}

/**
 * The pair this much travel picks STARTING FROM `base`, over a field whose
 * slots reach only as far as `ranges` says. The same accumulated-travel rule
 * as the stance square — the field's travel box spans each slot's whole range
 * — clamped once, on the sum. A field with no travel in it keeps the base.
 */
export function rangedPairFrom(
  base: StancePair,
  rect: PadRect,
  travel: PadTravel,
  inset: number,
  ranges: PadRanges,
): StancePair {
  const halfExtent = padTravelHalfExtent(rect, inset);
  if (halfExtent === 0) return clampToRanges(base, ranges);
  return clampToRanges(
    {
      pDirected: base.pDirected + travel.dx * perPixel(ranges.pDirected, halfExtent),
      pInterest: base.pInterest - travel.dy * perPixel(ranges.pInterest, halfExtent),
    },
    ranges,
  );
}

/**
 * Where the knob for this pair sits, as a percentage of the travel box, over
 * a field bounded by `ranges`. The range's low ends are the box's left and
 * bottom edges; screen y grows downward, so the vertical inverts.
 */
export function rangedPercentOf(
  pair: StancePair,
  ranges: PadRanges,
): { readonly x: number; readonly y: number } {
  const bounded = clampToRanges(pair, ranges);
  return {
    x: percent(fractionOf(bounded.pDirected, ranges.pDirected)),
    y: 100 - percent(fractionOf(bounded.pInterest, ranges.pInterest)),
  };
}

/**
 * Where a slot's zero falls on the field, as a percentage — or null when the
 * slot never reaches zero from both sides, so no dead-ground line is drawn on
 * the field's own edge, where it would read as a border.
 */
export function zeroPercentOf(range: AxisRange): number | null {
  return range.min < 0 && range.max > 0 ? percent(fractionOf(0, range)) : null;
}
