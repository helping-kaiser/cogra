// THE ONE-AXIS TABLE — the face a pick that names no pair wears.
//
// An opinion on one's own post is ONE number (jakob's ruling, 2026-09-14:
// "the second number isn't yours to set on your own post"). A post always
// reaches its author in full, so `pInterest` is not a value the author
// picks, and `nearestAnchor` cannot answer for a value that names no
// pair: asked for the nearest of twenty points to a value with only an
// x, it would have to invent a y.
//
// So the six here are the twenty's pure-valence spine — the mild, middle
// and far face on each side, at ±0.15, ±0.55 and ±0.90. Glyph, word and
// position are READ from `STANCE_ANCHORS`, so the six are six OF the
// twenty and cannot drift from them.
//
// THE BANDS ARE WRITTEN, NOT COMPUTED, and this is the reason the module
// exists rather than a one-line helper. They are the midpoints between
// neighbouring anchors — ±0.35 and ±0.725 — but derived at runtime the
// first of those comes out as −0.7250000000000001, and a band edge that
// depends on the order of a multiply is a face that depends on the
// platform. The edges are spelled, every comparison is a `<` or an
// `===`, and Kotlin's `ValenceBands.kt` spells the same six: the two
// clients answer byte-identically for every value, including the edges.
//
// The master is `design/components/stance/StanceReadout.jsx`'s
// `VALENCE_SIX` / `nearestValenceAnchor`, and the design gate
// `check-readouts` holds the boards to it.

import { STANCE_ANCHORS } from "./anchors";
import { clampDimension } from "./model";

/**
 * The one axis, named on screen (design/readme.md §11: `How you stand` →
 * **For or against**).
 *
 * A NAMED DIVERGENCE: `stance-format.ts`'s `DIRECTED_LABEL` still carries
 * the pre-rename wording and feeds every two-axis surface, so renaming it
 * here would rewrite the bloomed control's readouts from inside a lane
 * that does not touch them. The one-axis surfaces take the current name;
 * the two-axis ones are reported rather than renamed in passing.
 */
export const VALENCE_LABEL = "For or against";

/** The ends of the axis, drawn on the field (design/readme.md §11). */
export const VALENCE_POLES = ["Against", "For"] as const;

/** What the pad's readout block is called (design/backlog.md item 30). */
export const PICK_LABEL = "Your pick";

export type ValenceBand = {
  readonly emoji: string;
  readonly label: string;
  /** Where the band's own anchor sits — the twenty's, not a new point. */
  readonly pDirected: number;
  /** The band owns the axis up to here. */
  readonly to: number;
  /** Whether the edge itself belongs to this band. */
  readonly toInclusive: boolean;
};

/**
 * EACH ROW OWNS THE AXIS UP TO ITS `to`, and `toInclusive` says whether
 * the edge itself belongs to it. Away from the edges this is the nearest
 * anchor by distance; the asymmetry in `toInclusive` is where the two
 * ruled tie-breaks live, and it is the same rule stated twice:
 *
 *   - AT A MIDPOINT THE MILDER FACE WINS — the one nearer zero. On the
 *     negative side that is the band above, so a negative row stops
 *     short of its edge; on the positive side it is the band below, so a
 *     positive row keeps it.
 *   - EXACTLY 0.00 READS 🙂 — the 😕 row stops short of zero, so zero
 *     falls into the first band above it.
 */
const BANDS: readonly Omit<ValenceBand, "label" | "pDirected">[] = [
  { emoji: "😠", to: -0.725, toInclusive: false },
  { emoji: "🙁", to: -0.35, toInclusive: false },
  { emoji: "😕", to: 0, toInclusive: false },
  { emoji: "🙂", to: 0.35, toInclusive: true },
  { emoji: "😊", to: 0.725, toInclusive: true },
  { emoji: "😍", to: 1, toInclusive: true },
];

/**
 * The six, read out of the twenty. A face the anchor table does not
 * carry is the contract having drifted, and the module says so at import
 * rather than rendering a band with no word and no position.
 */
function anchorFor(emoji: string) {
  const anchor = STANCE_ANCHORS.find((candidate) => candidate.emoji === emoji);
  if (anchor === undefined) {
    throw new Error(`the one-axis table names ${emoji}, which STANCE_ANCHORS no longer carries`);
  }
  return anchor;
}

/** Six monotone bands covering the closed axis, in order. */
export const VALENCE_SIX: readonly ValenceBand[] = BANDS.map((band) => {
  const anchor = anchorFor(band.emoji);
  return { ...band, pDirected: anchor.pDirected, label: anchor.label };
});

/**
 * The face a ONE-AXIS pick wears — the first band the value falls
 * inside. The bands cover the closed axis, so every value has exactly
 * one; out of range is clamped in rather than refused, the way the pad
 * clamps.
 *
 * Interval comparison only: no distance is computed, so there is no
 * float arithmetic here for two platforms to round differently.
 */
export function nearestValenceAnchor(pDirected: number): ValenceBand {
  const value = clampDimension(pDirected);
  for (const band of VALENCE_SIX) {
    if (value < band.to || (band.toInclusive && value === band.to)) return band;
  }
  return VALENCE_SIX[VALENCE_SIX.length - 1];
}
