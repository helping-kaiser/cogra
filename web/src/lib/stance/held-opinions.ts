// WHO HOLDS AN OPINION ON THIS (PostOpinions.md; CommentOpinionsEmpty.md;
// ProfileStances.md): opinion records folded into one row per person.
//
// THE RECORDS ARE NOT THE ROWS. The chronicle serves every record — a revised
// opinion is a parallel record in its author's bundle (api-spec.md "The graph
// is a chronicle") — while the lists draw PEOPLE and their standing opinion,
// and the detail's line counts exactly those rows ("the count IS the list's
// length", PostDetail.md; "holds as many rows as the detail's opinions line
// counts", PostOpinions.md). A record count would read 3 for one person who
// revised twice. So the client replays the published fold: a bundle's
// sum-then-clip, payload-marked records excluded (api-spec.md "The read-side
// bundle fold"; feed-ranking.md §3.2), the sum exact (`exactSum`).
//
// THE ROW'S PERSON IS THE BUNDLE'S KEY. A stance bundle is one author toward
// one target, and every list this fold serves holds one side fixed: the
// opinions ON a node fix the target, so each author is a row; the opinions BY
// a person fix the author, so each target is a row (`ProfileStances`' `By
// them`). The caller names which side is the row's `holder`.
//
// A BUNDLE AT (0, 0) IS STILL A STANDING (api-spec.md "Severed is the
// bundle's history, not its pair"): walked back or saying nothing, the row
// keeps its place and speaks which — `StanceRow`'s `severed`, read off the
// newest record's own `severed` (api-spec.md `Record.severed`: "StanceBundle.
// severed read as of this record").
//
// STRONGEST FIRST, by the for-or-against value, down past nothing into the
// ones held against (PostOpinions.md; ProfileStances.md). Ties keep a fixed
// order — the reach, then the holder's address — so one read draws one list
// every time.

import { newestOf, type CausalKey } from "@/lib/records/causal-key";

import { exactSum } from "./exact";
import { clampDimension, type StancePair } from "./model";

/**
 * One opinion record as the fold reads it. `holderId` is the address of the
 * person the row is about — the author on a node's list, the target on a
 * person's own — and `holder` rides through untouched.
 */
export type OpinionRecord<H> = CausalKey & {
  readonly holderId: string;
  readonly holder: H;
  readonly pDirected: number;
  readonly pInterest: number;
  readonly severed?: boolean | null;
  readonly payloadMarked: boolean;
};

/** One standing opinion: a list row. */
export type HeldOpinion<H> = {
  readonly holderId: string;
  /** The holder as the newest record served them. */
  readonly holder: H;
  readonly pair: StancePair;
  /** Walked back to nothing — `Walked back`, where a never-severed (0, 0) says nothing. */
  readonly severed: boolean;
};

export function foldHeldOpinions<H>(records: readonly OpinionRecord<H>[]): HeldOpinion<H>[] {
  const bundles = new Map<string, OpinionRecord<H>[]>();
  for (const record of records) {
    if (record.payloadMarked) continue;
    const bundle = bundles.get(record.holderId);
    if (bundle === undefined) bundles.set(record.holderId, [record]);
    else bundle.push(record);
  }
  const held: HeldOpinion<H>[] = [];
  for (const [holderId, bundle] of bundles) {
    const newest = newestOf(bundle);
    held.push({
      holderId,
      holder: newest.holder,
      pair: {
        pDirected: clampDimension(exactSum(bundle.map((r) => r.pDirected))),
        pInterest: clampDimension(exactSum(bundle.map((r) => r.pInterest))),
      },
      severed: newest.severed === true,
    });
  }
  return held.sort(
    (a, b) =>
      b.pair.pDirected - a.pair.pDirected ||
      b.pair.pInterest - a.pair.pInterest ||
      (a.holderId < b.holderId ? -1 : a.holderId > b.holderId ? 1 : 0),
  );
}
