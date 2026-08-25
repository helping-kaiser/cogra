// The seam the stance control talks to — and the only thing it talks to.
//
// `apollo-stance-data.ts` implements it over the real operations;
// `stub-stance-data.ts` implements it for tests. The control imports
// neither: it reads whichever one the provider holds.
//
// The semantics the interface encodes (design.md §8.1, api-spec.md
// "The generic stance"):
//
//   - RAW EDGE. `commit` sends the picked pair verbatim. There is no
//     delta anywhere in this file: the client never computes one, and
//     nothing here lets it.
//   - READ-SIDE FOLD. Current standing and the projection of a candidate
//     pick are both *reads*. They come back from the fold; the control
//     renders them and never derives one from the other.
//   - INERTNESS AND SEVERANCE ARE FLAGS, NOT COMPARISONS. Whether a
//     bundle or a landing carries nothing is the fold's statement about
//     itself (`inert`, `severed` on `StanceBundle` and
//     `StanceProjection`). No caller re-derives either by testing a
//     value against zero. The one thing that does is the LIVE LANDING
//     LINE, which §8.3 makes a local fold of the served raw sums so it
//     can keep up with a drag; that line is display, and `project` is
//     still what answers before anything is signed.
//   - SEVERANCE IS ITS OWN GESTURE. `sever` states the intent; the batch
//     of counter-records that nets the bundle to (0, 0) is assembled on
//     the far side. Each record is its own priced act, so the batch size
//     is what makes the cost legible before signing (api-spec.md "A
//     prepare may stage a batch").

import type { Outcome } from "@/lib/api/outcome";
import type { StancePair } from "./model";

/**
 * Which root the stance read enters through. `viewerStance` is a field
 * on Post, Comment, and User, and no interface gathers the three, so the
 * target's kind is part of naming it — every call site knows it
 * statically.
 */
export type StanceTargetKind = "post" | "comment" | "profile";

/** What the seam needs to name a target. */
export type StanceTarget = {
  readonly id: string;
  readonly kind: StanceTargetKind;
};

/** The same, plus how copy names it. */
export type StanceTargetRef = StanceTarget & {
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
  /**
   * The raw sums behind that fold, before the clip at `±1` — beyond it
   * where the bundle carries more than the fold shows (design.md §8.3,
   * "clipped is not hidden"). Two surfaces need them: the landing line,
   * which folds them locally against the pick so it can keep up with a
   * drag, and every surface that explains cost, because the raw sums are
   * what a walk back to zero actually walks (§8.5).
   *
   * Served, never derived: a client cannot recover them from `current`,
   * which is exactly why they are on the wire.
   */
  readonly rawSum: StancePair;
  /** How many records the bundle folds; zero is a target never stanced. */
  readonly records: number;
  /** Either axis at zero, as the fold reports it. */
  readonly inert: boolean;
  /** Both axes at zero, as the fold reports it. */
  readonly severed: boolean;
  readonly severance: SeveranceCost;
};

/** Where a candidate pick lands the bundle — the fold's answer, not a sum. */
export type StanceLanding = {
  readonly landing: StancePair;
  /** Either axis at zero, as the fold reports it. */
  readonly inert: boolean;
  /** Both axes at zero — the pick reaches severance. */
  readonly severed: boolean;
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
  /**
   * This read follows the viewer's own write, so its answer must be the
   * state that write produced — never the state before it, which reads as
   * the gesture having done nothing (design.md §8.3, "a gesture that
   * stages a priced act must never be silent"). An implementation that
   * asks the server for every viewer-scoped read already satisfies it.
   */
  readonly fresh?: boolean;
};

export const INCLUDE_PENDING_DEFAULT = true;

export interface StanceData {
  /**
   * The viewer's standing toward `target`. A bundle folding no records is
   * a target never stanced, not an absent one; a viewer with no bundle to
   * read at all — a stale token, or an account with no actor on the graph
   * — is the shared UNAUTHENTICATED refusal, as every viewer-only read is.
   */
  bundle(target: StanceTarget, options?: StanceReadOptions): Promise<Outcome<StanceBundle>>;

  /** Where `pick` would land the bundle — the fold's answer, not a sum. */
  project(
    target: StanceTarget,
    pick: StancePair,
    options?: StanceReadOptions,
  ): Promise<Outcome<StanceLanding>>;

  /** Author one edge carrying exactly `pick`, and sign it. */
  commit(target: StanceTarget, pick: StancePair): Promise<Outcome<StanceCommit>>;

  /** Author the counter-record batch that nets the bundle to `(0, 0)`. */
  sever(target: StanceTarget): Promise<Outcome<StanceCommit>>;
}
