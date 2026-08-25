// The emoji readout of design.md §8.4: twenty anchors placed in the
// field, the readout being the nearest one by Euclidean distance. They
// are deliberately dense in the for-it-and-want-it quadrant, where most
// real stances land, and sparse at the extremes — a regular grid cannot
// express that and puts visible seams in a continuous field.
//
// The table in design.md §8.4 is the contract both clients read;
// anchors.test.ts parses that table and fails on any drift, so these
// values are pinned rather than transcribed.
//
// The readout is lossy and decoupled from the value: the committed pair
// stays the exact continuous one, and anchor count controls readability
// only, never precision.

import type { StancePair } from "./model";

export type StanceAnchor = StancePair & {
  readonly emoji: string;
  readonly label: string;
};

export const STANCE_ANCHORS: readonly StanceAnchor[] = [
  { pDirected: 0.15, pInterest: 0.15, emoji: "🙂", label: "Nice" },
  { pDirected: 0.55, pInterest: 0.2, emoji: "😊", label: "Like this" },
  { pDirected: 0.9, pInterest: 0.25, emoji: "😍", label: "Love this" },
  { pDirected: 0.2, pInterest: 0.6, emoji: "👀", label: "Show me more" },
  { pDirected: 0.6, pInterest: 0.65, emoji: "🤩", label: "Really into this" },
  { pDirected: 0.25, pInterest: 0.95, emoji: "🍿", label: "Tell me everything" },
  { pDirected: 0.95, pInterest: 0.9, emoji: "🔥", label: "All in" },
  { pDirected: -0.15, pInterest: 0.15, emoji: "😕", label: "Not for me" },
  { pDirected: -0.55, pInterest: 0.25, emoji: "🙁", label: "Don't like this" },
  { pDirected: -0.9, pInterest: 0.3, emoji: "😠", label: "Really against this" },
  { pDirected: -0.45, pInterest: 0.75, emoji: "😤", label: "Against, but keep me posted" },
  { pDirected: -0.9, pInterest: 0.9, emoji: "🤬", label: "Against, and I want all of it" },
  { pDirected: 0.2, pInterest: -0.2, emoji: "😶", label: "Fine, just not for me" },
  { pDirected: 0.7, pInterest: -0.3, emoji: "😌", label: "Good, but not in my world" },
  { pDirected: 0.3, pInterest: -0.8, emoji: "🙈", label: "Rather not see this" },
  { pDirected: 0.9, pInterest: -0.85, emoji: "🤐", label: "Good, keep it away" },
  { pDirected: -0.2, pInterest: -0.2, emoji: "😑", label: "Meh" },
  { pDirected: -0.6, pInterest: -0.45, emoji: "😖", label: "Dislike, keep away" },
  { pDirected: -0.35, pInterest: -0.85, emoji: "🚫", label: "Keep this away" },
  { pDirected: -0.9, pInterest: -0.9, emoji: "💀", label: "Absolutely not" },
];

/**
 * The nearest anchor by Euclidean distance. Squared distance orders the
 * same way and skips the root; the first of an exact tie wins, so the
 * result is a total function of the pair rather than of iteration luck.
 */
export function nearestAnchor(pair: StancePair): StanceAnchor {
  let best = STANCE_ANCHORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of STANCE_ANCHORS) {
    const dd = anchor.pDirected - pair.pDirected;
    const di = anchor.pInterest - pair.pInterest;
    const distance = dd * dd + di * di;
    if (distance < bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}

/** What a bundle standing at exactly `(0, 0)` reads as (design.md §8.4). */
export const ZERO_BUNDLE_EMOJI = "🤷";

/**
 * The face an unauthored target wears at rest (design.md §8.3, Q42).
 * Deliberately outside the table, so an empty control can never read as
 * a standing the viewer already holds — and deliberately not the shrug,
 * which means "severed, or netted to zero": a bundle that exists and
 * came to nothing is a different thing from one that was never given
 * anything, and the read tells the two apart.
 */
export const RESTING_FACE_EMOJI = "😐";

/** Just the emoji and the words — what every readout surface renders. */
export type StanceReadout = {
  readonly emoji: string;
  readonly label: string;
};

/**
 * The readout a STANDING wears. A bundle at exactly `(0, 0)` is the
 * absence of a feeling, and drawing it as its nearest neighbour — "🙂
 * Nice", which is what the table returns at the origin — is a lie
 * (design.md §8.4). It gets the shrug and the caller's own severed or
 * no-standing wording instead; the table reads picks and non-zero
 * bundles only.
 *
 * This is not the zero test `stance-data.ts` forbids. That rule is about
 * SEMANTICS: whether a bundle is inert or severed is the fold's
 * statement about itself and still arrives as a flag, never as a
 * comparison made here. This is about which glyph a pair may be drawn
 * as, and the table simply does not cover the origin.
 */
export function bundleReadout(pair: StancePair, zeroLabel: string): StanceReadout {
  if (pair.pDirected === 0 && pair.pInterest === 0) {
    return { emoji: ZERO_BUNDLE_EMOJI, label: zeroLabel };
  }
  return nearestAnchor(pair);
}
