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
  return Math.min(DIMENSION_MAX, Math.max(DIMENSION_MIN, value));
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

/**
 * A folded parameter of zero is routing-inert — it carries nothing
 * (design.md §8.2, feed-ranking.md §3). Read off a *folded* pair, never
 * off the value being written.
 */
export function inertAxes(pair: StancePair): {
  readonly directed: boolean;
  readonly interest: boolean;
} {
  return { directed: pair.pDirected === 0, interest: pair.pInterest === 0 };
}

/** A bundle netted to `(0, 0)` — severance (design.md §8.2). */
export function isSevered(pair: StancePair): boolean {
  return pair.pDirected === 0 && pair.pInterest === 0;
}

/**
 * The exact values, for the readers who want them — never the default
 * reading (design.md §8.3, §8.6). Two decimals, the same precision the
 * paired sliders step at.
 */
export function formatPair(pair: StancePair): string {
  return `${pair.pDirected.toFixed(2)}, ${pair.pInterest.toFixed(2)}`;
}
