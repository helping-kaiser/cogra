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

export function clampDimension(value: number): number {
  if (Number.isNaN(value)) return 0;
  const bounded = Math.min(DIMENSION_MAX, Math.max(DIMENSION_MIN, value));
  // Negative zero is not a direction. It arises from the pad's inverted
  // vertical axis on any drag that never moved vertically, and it would
  // otherwise travel into a record as a value of its own.
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

// Whether a folded pair is routing-inert or severed is the FOLD's
// statement about itself, and arrives as a flag on the read
// (`stance-data.ts`). No predicate for it lives here: a client that
// could compare a value against zero would eventually do so, and the
// answer it reached would be its own rather than the graph's.
