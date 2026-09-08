// Where a pick lands the bundle, computed locally (design.md §8.3).
//
// "The landing updates in real time. The read that rendered the surface
// already carries the viewer's bundle — its raw sums, not only the fold
// — so the landing is a local fold (`clip` of sum plus pick) recomputed
// live under the drag, with no round trip and no visible lag."
//
// THE RAW SUMS ARE THE INPUT, NOT THE FOLD. A bundle whose raw sum lies
// beyond the clip still carries that history (§8.3, "clipped is not
// hidden"), and folding the pick against the CLIPPED number would invent
// landings the graph does not agree with: a bundle summing to (+5, +5)
// shows a fold of (+1, +1), and a (−1, −1) pick against the fold would
// read as severance while the graph lands at (+4, +4). The whole reason
// the raw sums are on the wire is that they cannot be recovered from the
// folded pair.
//
// WHAT THIS IS FOR. Display, under the drag. The staged record still
// carries exactly the picked values (§8.1), and the backend's projection
// remains the authority the moment anything is signed — the control asks
// for it in `commitChecked` before every commit, severance check
// included. This module never decides what gets written.

import { clampPair, isInert, isSevered, type StancePair } from "./model";
import type { StanceLanding } from "./stance-data";

/**
 * The landing this pick produces against these raw sums.
 *
 * The flags are read off the CLIPPED landing, which is the number the
 * graph routes on: a raw sum of (+5, +5) with a (−5, −5) pick is inert
 * because the fold is zero, and a raw sum of (+5, +5) with a (−1, −1)
 * pick is not, because the fold is not.
 */
export function localLanding(rawSum: StancePair, pick: StancePair): StanceLanding {
  const landing = clampPair({
    pDirected: rawSum.pDirected + pick.pDirected,
    pInterest: rawSum.pInterest + pick.pInterest,
  });
  return { landing, inert: isInert(landing), severed: isSevered(landing) };
}
