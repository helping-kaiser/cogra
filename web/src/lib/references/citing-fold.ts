// WHAT CITES THIS (CitedBy.md; CommentCitedByEmpty.md): the reference records
// whose terminal leg lands on a node, folded into one row per standing
// citation.
//
// THE RECORDS ARE NOT THE ROWS. A citation is a bundle keyed by its full
// incidence — (author, citing artifact, target) — whose records NET: a
// citation revised twice folds to the sum of its three records, clipped, and
// one netting to (0, 0) is withdrawn and cites nothing (api-spec.md
// `ReferenceClaim`, "The read-side bundle fold"). The chronicle serves every
// one of those records, so a list drawn straight off it showed a revised
// citation twice and a withdrawn one as a row of counter-records — and the
// detail's `Cited by N` counted them all, while the sheet must hold exactly as
// many rows as that line counts (CitedBy.md). This is the outbound fold's own
// rule, read from the other end: the same set `RefsSheet` would show on the
// citing artifact.
//
// NEWEST FIRST (CitedBy.md): a chronicle of acts, ordered by the newest act
// on each citation — a re-declared citation is what has just arrived.

import { exactSum, netsToZero } from "@/lib/stance/exact";
import { laterThan, newestOf } from "@/lib/records/causal-key";
import { clampDimension, type StancePair } from "@/lib/stance/model";

/** One reference record as the fold reads it; `target` (the citing artifact) rides through. */
export type ReferenceRecord<T> = {
  readonly id: string;
  readonly authorId: string;
  /** The citing artifact's raw L1 id — the middle node of the hyper act. */
  readonly targetId: string;
  readonly target: T;
  readonly pDirected: number;
  readonly pInterest: number;
  readonly payloadMarked: boolean;
  readonly landingEpoch: number;
  readonly actTime: number;
  readonly position: number;
};

/** One standing citation: a sheet row. */
export type CitingArtifact<T> = {
  /** Stable across reads: the bundle's key. */
  readonly key: string;
  /** The citing artifact, as the newest record served it. */
  readonly target: T;
  readonly pair: StancePair;
};

export function foldCitingArtifacts<T>(records: readonly ReferenceRecord<T>[]): CitingArtifact<T>[] {
  const bundles = new Map<string, ReferenceRecord<T>[]>();
  for (const record of records) {
    if (record.payloadMarked) continue;
    const key = `${record.authorId} ${record.targetId}`;
    const bundle = bundles.get(key);
    if (bundle === undefined) bundles.set(key, [record]);
    else bundle.push(record);
  }
  const standing: { row: CitingArtifact<T>; newest: ReferenceRecord<T> }[] = [];
  for (const [key, bundle] of bundles) {
    const directed = bundle.map((r) => r.pDirected);
    const interest = bundle.map((r) => r.pInterest);
    // Withdrawn: the sums net to exactly zero on both axes.
    if (netsToZero(directed) && netsToZero(interest)) continue;
    const newest = newestOf(bundle);
    standing.push({
      newest,
      row: {
        key,
        target: newest.target,
        pair: {
          pDirected: clampDimension(exactSum(directed)),
          pInterest: clampDimension(exactSum(interest)),
        },
      },
    });
  }
  return standing
    .sort((a, b) => (laterThan(a.newest, b.newest) ? -1 : laterThan(b.newest, a.newest) ? 1 : 0))
    .map((entry) => entry.row);
}
