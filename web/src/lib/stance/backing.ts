// THE BACKING'S ARITHMETIC — what the one-axis pad's readouts say (round 15,
// jakob 2026-10-16, PR-101; master `StanceReadout.jsx`, `AttachmentStanding`
// and `AttachmentLandingLine`).
//
// THE PICK IS THE EDGE. The strip collects the record's OWN value — at compose
// the post's genesis Publish, at an edit the edit's own Publish (0.00 by
// default, which changes nothing) — and nothing here computes a delta. The
// readouts around the pick say what is newly set and what it comes to:
//
//   Current backing  the bundle's net now, `clip` of the raw sum
//   Your pick        this record
//   Backing after    `clip` of the RAW sum plus the pick — a bundle that has
//                    summed past ±1 lands where the graph will put it, not
//                    where the clipped net suggests — and clipped is never
//                    hidden: past the cap a quiet line states the total and
//                    the cap.
//
// ONLY THE WALK-BACK AIMS AT A RESULT: it parks the pick at the raw sum's
// opposite, clipped to the strip, and stands greyed while the backing already
// nets 0.00 (net 0 iff raw sum 0).
//
// "Backing" is the authoring bundle's word; "opinion" is the face record's —
// the two never trade places (copy-voice, *What an author signs with their
// own content is their BACKING*).

import { clampDimension, DIMENSION_MAX, DIMENSION_MIN } from "./model";

export const CURRENT_BACKING_LABEL = "Current backing";
export const BACKING_AFTER_LABEL = "Backing after";
export const WALK_IT_ALL_BACK = "Walk it all back";

/** Where the backing nets now: the bundle's raw sum, clipped. */
export function backingNet(rawSum: number): number {
  return clampDimension(rawSum);
}

/** Where a pick lands the backing — the master's `attachmentLanding`. */
export function attachmentLanding(
  rawSum: number,
  pick: number,
): { readonly raw: number; readonly landing: number; readonly capped: boolean } {
  const raw = rawSum + pick;
  return { raw, landing: clampDimension(raw), capped: raw > DIMENSION_MAX || raw < DIMENSION_MIN };
}

/**
 * The pick `Walk it all back` parks — the raw sum's opposite, clipped to the
 * strip — or null while the backing already nets 0.00, when the row stands
 * greyed ("you cant walk something back that is already walked back?").
 * Past ±1 one record reaches only as far as the strip does; the rest is
 * another edit's.
 */
export function walkBackPick(rawSum: number): number | null {
  if (backingNet(rawSum) === 0) return null;
  return clampDimension(-rawSum);
}
