// WHO HOLDS AN OPINION ON THIS (PostOpinions.md; CommentOpinionsEmpty.md):
// the opinion records on a node, folded into one row per person.
//
// THE RECORDS ARE NOT THE ROWS. The chronicle serves every record — a revised
// opinion is a parallel record in its author's bundle (api-spec.md "The graph
// is a chronicle") — while the sheet lists PEOPLE and their standing opinion,
// and the detail's line counts exactly those rows ("the count IS the list's
// length", PostDetail.md; "holds as many rows as the detail's opinions line
// counts", PostOpinions.md). A record count would read 3 for one person who
// revised twice. So the client replays the published fold: same-author
// sum-then-clip, keyed by author, payload-marked records excluded
// (api-spec.md "The read-side bundle fold"; feed-ranking.md §3.2), the sum
// exact (`exactSum`).
//
// A BUNDLE AT (0, 0) IS STILL A STANDING (api-spec.md "Severed is the
// bundle's history, not its pair"): walked back or saying nothing, the row
// keeps its place and speaks which — `StanceRow`'s `severed`, read off the
// newest record's own `severed` (api-spec.md `Record.severed`: "StanceBundle.
// severed read as of this record").
//
// STRONGEST FIRST, by the for-or-against value, down past nothing into the
// ones held against (PostOpinions.md). Ties keep a fixed order — the reach,
// then the author's address — so one read draws one list every time.

import { newestOf, type CausalKey } from "@/lib/records/causal-key";

import { exactSum } from "./exact";
import { clampDimension, type StancePair } from "./model";

/** One opinion record as the fold reads it; `author` rides through untouched. */
export type OpinionRecord<A> = CausalKey & {
  readonly authorId: string;
  readonly author: A;
  readonly pDirected: number;
  readonly pInterest: number;
  readonly severed?: boolean | null;
  readonly payloadMarked: boolean;
};

/** One person's standing opinion: a sheet row. */
export type HeldOpinion<A> = {
  readonly authorId: string;
  /** The author as the newest record served them. */
  readonly author: A;
  readonly pair: StancePair;
  /** Walked back to nothing — `Walked back`, where a never-severed (0, 0) says nothing. */
  readonly severed: boolean;
};

export function foldHeldOpinions<A>(records: readonly OpinionRecord<A>[]): HeldOpinion<A>[] {
  const bundles = new Map<string, OpinionRecord<A>[]>();
  for (const record of records) {
    if (record.payloadMarked) continue;
    const bundle = bundles.get(record.authorId);
    if (bundle === undefined) bundles.set(record.authorId, [record]);
    else bundle.push(record);
  }
  const held: HeldOpinion<A>[] = [];
  for (const [authorId, bundle] of bundles) {
    const newest = newestOf(bundle);
    held.push({
      authorId,
      author: newest.author,
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
      (a.authorId < b.authorId ? -1 : a.authorId > b.authorId ? 1 : 0),
  );
}
