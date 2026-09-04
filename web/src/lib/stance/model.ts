// The two continuous parameters every interaction carries (edges.md §1,
// design.md §8.1): valence `p_d` and connection `p_i`, both floats in the
// closed [-1, +1] the API's `Dimension` scalar bounds.
//
// The vocabulary here is the repo's, not the screen's (design.md §7): no
// user-facing copy in this module says "valence", "connection", `p_d`, or
// `p_i`.

/** One picked or folded pair. Field names match `PrepareStanceInput`. */
export type StancePair = {
  readonly pDirected: number;
  readonly pInterest: number;
};

export const DIMENSION_MIN = -1;
export const DIMENSION_MAX = 1;

/** The pad opens here, untilted toward either direction (design.md §8.3). */
export const ORIGIN: StancePair = { pDirected: 0, pInterest: 0 };

/**
 * What a plain tap commits — the repo-wide low-defaults policy, so
 * stronger stances stay expressible (design.md §8.3, invitations.md §3).
 * The low default belongs to the tap, never to the considered gesture.
 */
export const TAP_DEFAULT: StancePair = { pDirected: 0.1, pInterest: 0.1 };

/**
 * The reference's `clip` (`crates/common/src/l1/fold.rs`), value for
 * value: NaN to the origin, the rest bounded into `[-1, +1]`, and a
 * negative zero normalised away.
 *
 * NaN names no point in the range at all and `f64::clamp` returns it
 * unchanged, so the origin — the one answer in domain carrying no
 * direction — is what a nonsense parameter folds to. Negative zero is
 * not a direction either: it arises from the pad's inverted vertical
 * axis on any drag that never moved vertically, and `-0 === 0` compares
 * true while the two serialise differently, so an unnormalised zero
 * would travel into a record as a value of its own.
 */
export function clampDimension(value: number): number {
  if (Number.isNaN(value)) return 0;
  const bounded = Math.min(DIMENSION_MAX, Math.max(DIMENSION_MIN, value));
  return bounded === 0 ? 0 : bounded;
}

export function clampPair(pair: StancePair): StancePair {
  return {
    pDirected: clampDimension(pair.pDirected),
    pInterest: clampDimension(pair.pInterest),
  };
}

export function samePair(a: StancePair, b: StancePair): boolean {
  return a.pDirected === b.pDirected && a.pInterest === b.pInterest;
}

// WHAT A STORED BUNDLE IS, THE GRAPH SAYS. `inert` and `severed` arrive
// as flags on the read (`stance-data.ts`), and no surface re-derives
// them from the served pair — the fold's statement about itself is the
// answer, and a client's own comparison would be a second opinion.
//
// The two predicates below exist for the ONE thing that has no served
// answer: the landing line under a drag, which folds the raw sums
// against the pick locally so it can keep up with the thumb
// (design.md §8.3, `landing.ts`). That fold is display, and `project`
// is still what answers before anything is signed — but the flags it
// reports have to mean what the graph means by them, so they are the
// reference's own definitions rather than the pad's guess at them.

/**
 * Routing-inert on an axis — the reference's `NetStance::is_inert`:
 * "an edge with either parameter at `0` is routing-inert; indifference
 * is magnitude zero, not a third sign" (edges.md §1).
 */
export function isInert(pair: StancePair): boolean {
  return pair.pDirected === 0 || pair.pInterest === 0;
}

/**
 * Severance — the pair nets to `(0, 0)` (design.md §8.2), the
 * reference's `NetStance::is_severed`.
 */
export function isSevered(pair: StancePair): boolean {
  return pair.pDirected === 0 && pair.pInterest === 0;
}
