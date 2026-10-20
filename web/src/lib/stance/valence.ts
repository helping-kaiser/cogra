// THE ONE-AXIS TABLE — the face a pick that names no pair wears.
//
// The BACKING an author signs with their own content is ONE number (jakob
// 2026-10-16, PR-101): Publish carries `p_d = a` and the census pins
// `p_i = 1`, never a choice, so `nearestAnchor` cannot answer for it —
// asked for the nearest of twenty points to a value with only an x, it
// would have to invent a y. The author's OPINION on their own post is a
// different record, the ordinary pair the post's face takes.
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

import { STANCE_ANCHORS, UNREACHABLE_EMOJI } from "./anchors";
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
 *   - The 😕 row stops short of zero and the 🙂 row would take it, but
 *     `nearestValenceAnchor` answers EXACTLY 0.00 before the table is
 *     read: it wears 🤔 (jakob 2026-10-20), the one-zero face.
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
 * EXACTLY 0.00 THINKS on the one axis (jakob 2026-10-16, its face 🤔
 * since 2026-10-20): a backing of zero takes no side — with the second
 * number pinned at 1 it folds to `(0, 1)`, unreachable on its own path —
 * so it wears the one-zero face, spoken `No side taken`, never a band's
 * smile. Only the exact value; the bands keep the rest of the axis as
 * ruled (`StanceReadout.jsx`'s `UNREACHABLE_EMOJI`, `ZERO_BACKING_LABEL`).
 */
export const ZERO_BACKING_EMOJI = UNREACHABLE_EMOJI;
export const ZERO_BACKING_LABEL = "No side taken";

const ZERO_BACKING: ValenceBand = {
  emoji: ZERO_BACKING_EMOJI,
  label: ZERO_BACKING_LABEL,
  pDirected: 0,
  to: 0,
  toInclusive: true,
};

/**
 * The face a ONE-AXIS pick wears — 🤔 at exactly 0.00, otherwise the
 * first band the value falls inside. The bands cover the closed axis, so
 * every value has exactly one; out of range is clamped in rather than
 * refused, the way the pad clamps.
 *
 * Interval comparison only: no distance is computed, so there is no
 * float arithmetic here for two platforms to round differently.
 */
export function nearestValenceAnchor(pDirected: number): ValenceBand {
  const value = clampDimension(pDirected);
  if (value === 0) return ZERO_BACKING;
  for (const band of VALENCE_SIX) {
    if (value < band.to || (band.toInclusive && value === band.to)) return band;
  }
  return VALENCE_SIX[VALENCE_SIX.length - 1];
}
