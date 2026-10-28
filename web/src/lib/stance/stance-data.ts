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
import type { KeptTargetPreview } from "./kept-preview";
import type { StancePair } from "./model";

/**
 * Which root the stance read enters through. `viewerStance` is a field
 * on Post, Comment, User, and Hashtag, and no interface gathers them, so
 * the target's kind is part of naming it — every call site knows it
 * statically. A topic's identity is its canonical name, not a UUID
 * (hashtag.md §1), so `"topic"` is the one kind whose `StanceTarget.id`
 * carries a name rather than an id — the field stays named `id` because
 * every other caller treats it as an opaque identifier already.
 */
export type StanceTargetKind = "post" | "comment" | "profile" | "topic";

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
  /**
   * Walked back to nothing — the bundle's HISTORY, as the API serves it: it
   * nets to `(0, 0)` and its newest record said something. False on a bundle
   * of no records, and false on one an empty sign left at `(0, 0)`, which
   * stands there saying nothing (`StanceBundle.severed`, api-spec.md "The
   * read-side bundle fold").
   */
  readonly severed: boolean;
  readonly severance: SeveranceCost;
};

/**
 * Where a candidate pick lands, and the standing it was read against — one
 * read answers both (`viewerStance(pick:)`). The landing's `severed` is the
 * pair alone ("the pick reaches (0, 0)"); whether that is a walk-back or an
 * empty sign is the standing's to say — its `records` and its `severed`
 * (`StanceProjection.severed`, schema.graphql).
 */
export type StanceProjection = StanceLanding & {
  readonly standing: StanceBundle;
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

  /**
   * Where `pick` would land the bundle — the fold's answer, not a sum — and
   * the standing it lands in, read in the same round trip.
   */
  project(
    target: StanceTarget,
    pick: StancePair,
    options?: StanceReadOptions,
  ): Promise<Outcome<StanceProjection>>;

  /** Author one edge carrying exactly `pick`, and sign it. */
  commit(target: StanceTarget, pick: StancePair): Promise<Outcome<StanceCommit>>;

  /**
   * Author the counter-record batch that nets the bundle to `(0, 0)`.
   * `shown` is the standing the reader confirmed against: the batch is
   * signed only if it nets exactly those raw sums, in exactly the records
   * its cost stated (intent.ts).
   */
  sever(target: StanceTarget, shown: StanceBundle): Promise<Outcome<StanceCommit>>;

  /**
   * Whether this device can sign at all — the signing key is here. Asked
   * before a gesture stages anything, so the pad can carry the key notice
   * (PadKeyAbsent.md) rather than fail a signature it could never give.
   */
  keyOnDevice(): Promise<boolean>;

  /**
   * Whether the account has a recovery backup — null when that cannot be
   * read. Asked only once the key is known to be elsewhere: with no backup
   * there is nothing to restore from, so the key notice drops `Restore the
   * key` and says so (KeyElsewhereNoBackup.md, PadKeyAbsent.md).
   */
  keyBackedUp(): Promise<boolean | null>;

  /**
   * The kept picks, signed together (KeptPicksSeal.md): each pick prepared
   * toward its own target, then the whole staged set checked against the
   * picks as the seal read them back and signed in one pass — never a pick
   * signed on its own. A refusal keeps its codes (the write rule is a notice,
   * not a fault).
   */
  commitBatch(entries: readonly KeptEntry[]): Promise<Outcome<StanceCommit>>;

  /** What a kept pick's row names its target by, read live (KeptPicksReview.md). */
  preview(target: StanceTarget): Promise<Outcome<KeptTargetPreview>>;
}

/** One kept pick on its way to the seal: the target and exactly the pair kept. */
export type KeptEntry = {
  readonly target: StanceTarget;
  readonly pick: StancePair;
};
