// The seam the stance control talks to — and the only thing it talks to.
//
// Slice 2.2's backend half (the reworked raw-edge `prepareStance`, the
// read-side bundle fold, and severance's wire shape, which api-spec.md
// "The generic stance" leaves to settle with this slice) is not merged.
// So the UI is written against this interface rather than against
// operations that do not exist yet: `stub-stance-data.ts` implements it
// for tests and for the app until the wiring follow-up implements it over
// Apollo. Nothing here imports a GraphQL document.
//
// The semantics the interface encodes (design.md §8.1, api-spec.md
// conventions):
//
//   - RAW EDGE. `commit` sends the picked pair verbatim. There is no
//     delta anywhere in this file: the client never computes one, and
//     nothing here lets it.
//   - READ-SIDE FOLD. Current standing and the projection of a candidate
//     pick are both *reads*. They come back from the fold; the control
//     renders them and never derives one from the other.
//   - SEVERANCE IS ITS OWN GESTURE. `sever` states the intent; the batch
//     of counter-records that nets the bundle to (0, 0) is assembled on
//     the far side. Each record is its own priced act, so the batch size
//     is what makes the cost legible before signing (api-spec.md "A
//     prepare may stage a batch").

import type { Outcome } from "@/lib/api/outcome";
import type { StancePair } from "./model";

/** What the control is stancing, and how copy names it. */
export type StanceTargetRef = {
  readonly id: string;
  /** Reader-facing, already in the reader's own words: "this post", "@ada". */
  readonly label: string;
};

/**
 * What reaching `(0, 0)` from here would take: one counter-record per
 * live bundle entry, each its own θ-debit priced in proportion to the
 * conviction being walked back (feed-ranking.md §8.1). Zero records means
 * the bundle is already inert — there is nothing left to walk back.
 */
export type SeveranceCost = {
  readonly records: number;
};

/** The viewer's read-side bundle toward one target (design.md §8.1). */
export type StanceBundle = {
  /** Where the bundle currently nets — never a value the client computed. */
  readonly current: StancePair;
  readonly severance: SeveranceCost;
};

/** What a completed gesture staged — one record for a pick, N for a severance. */
export type StanceCommit = {
  readonly records: number;
};

/**
 * Pending stances count by default — the `includePending` convention
 * every listing already follows (api-spec.md; content-api.ts). A stance
 * that is signed but not yet ordered is real; only its place in the order
 * is outstanding (design.md §9).
 */
export type StanceReadOptions = {
  readonly includePending?: boolean;
};

export const INCLUDE_PENDING_DEFAULT = true;

export interface StanceData {
  /** The viewer's standing toward `target`; null where they hold none yet. */
  bundle(target: string, options?: StanceReadOptions): Promise<Outcome<StanceBundle | null>>;

  /** Where `pick` would land the bundle — the fold's answer, not a sum. */
  project(
    target: string,
    pick: StancePair,
    options?: StanceReadOptions,
  ): Promise<Outcome<StancePair>>;

  /** Author one edge carrying exactly `pick`, and sign it. */
  commit(target: string, pick: StancePair): Promise<Outcome<StanceCommit>>;

  /** Author the counter-record batch that nets the bundle to `(0, 0)`. */
  sever(target: string): Promise<Outcome<StanceCommit>>;
}
