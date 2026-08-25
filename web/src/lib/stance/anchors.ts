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
