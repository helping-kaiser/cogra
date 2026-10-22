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
 * The bare table walk. Nothing outside this file calls it: every pair drawn
 * as a face reads through [bundleReadout], which answers the zero lines
 * first (the master's structure, seam 243).
 *
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
 * ONE NUMBER AT ZERO THINKS; BOTH AT ZERO SHRUG (jakob 2026-10-20: "shrug
 * should be the 0,0 only"). A state with exactly one number at zero — an
 * unreachable landing, and the one-axis 0.00, which is `(0, 1)` with the
 * pin — wears 🤔, outside the table like 🤷 and 🫥, so the held,
 * unreachable state never reads as severance's face. The master is
 * `StanceReadout.jsx`'s `UNREACHABLE_EMOJI`.
 */
export const UNREACHABLE_EMOJI = "🤔";

/**
 * The face an unauthored target wears at rest (design.md §8.3, Q42).
 * Deliberately outside the table, so an empty control can never read as
 * a standing the viewer already holds — and deliberately not the shrug,
 * which means "severed, or netted to zero": a bundle that exists and
 * came to nothing is a different thing from one that was never given
 * anything, and the read tells the two apart.
 */
export const RESTING_FACE_EMOJI = "🫥";

/** Just the emoji and the words — what every readout surface renders. */
export type StanceReadout = {
  readonly emoji: string;
  readonly label: string;
};

/**
 * A PICK OF NOTHING SAYS NOTHING (the master's `EMPTY_PICK_LABEL`). A pick
 * at exactly `(0, 0)` adds nothing to what stands, and a STANDING at
 * `(0, 0)` that was never walked back — an empty sign joined it (jakob
 * 2026-10-21) — is the same nothing: `Walked back` would be false of both.
 */
export const EMPTY_PICK_LABEL = "Says nothing";

/**
 * The state a pair with exactly one number at zero is in, named by the
 * other number's sign (the master's `unreachableHead`, seam 240): held,
 * shaping no feed, and not severance.
 */
export function unreachableHead(pair: StancePair): string {
  if (pair.pDirected === 0) {
    return pair.pInterest > 0 ? "Interested, no side taken" : "Rather not see it, no side taken";
  }
  return pair.pDirected > 0 ? "For it, no interest either way" : "Against it, no interest either way";
}

/**
 * FACES FOLLOW THE VALUE, EVERYWHERE (jakob 2026-10-21, seam 242; the
 * master's `bundleReadout`). Every pair drawn as a face reads HERE — the
 * pick, a standing opinion, the resting anchor, a record's row, the
 * snackbar, a citation's pair — and nothing else on the client reads the
 * table: exactly `(0, 0)` shrugs and speaks the caller's word for WHICH
 * zero it is (`Walked back`, `Says nothing`); exactly one zero thinks and
 * names its state; only a pair with both numbers non-zero reads the
 * twenty anchors. 🫥 stays the control's own, outside every value.
 *
 * This is not the zero test `stance-data.ts` forbids. That rule is about
 * SEMANTICS: whether a bundle is inert or severed is the fold's
 * statement about itself and still arrives as a flag, never as a
 * comparison made here. This is about which glyph a pair may be drawn
 * as, and the table does not cover the zero lines.
 */
export function bundleReadout(pair: StancePair, zeroLabel: string): StanceReadout {
  const directedZero = pair.pDirected === 0;
  const interestZero = pair.pInterest === 0;
  if (directedZero && interestZero) return { emoji: ZERO_BUNDLE_EMOJI, label: zeroLabel };
  if (directedZero || interestZero) return { emoji: UNREACHABLE_EMOJI, label: unreachableHead(pair) };
  return nearestAnchor(pair);
}
