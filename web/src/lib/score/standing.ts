// A THING'S STANDING ON EVERY SURFACE THAT WEARS ITS SCORE (score-readout
// packet CD-SR5, CD-9; FeedKinds.md:7-15; PostDetail.md:19; History.md:29;
// Saved.md:13; TagPage.md:23; ProfilePosts.md:37).
//
// "The figure the latest fetch of its thing found — the reader's own last
// feed fetch, or its trace's fetch since — a dash only where that fetch found
// none." So one store holds both fetches:
//
// - THE HELD RANKING: the reader's last `feedRanking` answer, UNCUT (CD-9) —
//   the same answer the feed derives its list from, so a thing the derive cut
//   as seen or out of the reader's people still hits. Every off-feed slot
//   looks its thing up here (PR-40, transport 1a), and a miss is the dash.
// - THE ADOPTIONS: what each trace's live fetch found, per thing, whichever
//   surface it was opened from (PR-39). A figure the trace found other than
//   the held one replaces it everywhere that thing is drawn — a number, or the
//   dash where the trace found no paths — and the old figure never shows
//   again. Nothing ever re-orders for it: the store is read for figures, and
//   no list is ever sorted by it.
//
// ONLY A FEED FETCH CLEARS AN ADOPTION. A new ranking replaces the held answer
// and every adoption with it (FeedKinds.md:13; CD-9: "only a fetch replaces
// the answer, and with it every adoption"); a local re-derive keeps the same
// answer and so keeps them. Nothing here re-reads anything in the background
// (FeedKinds.md:9): the trace's tap is the only per-thing fetch there is.
//
// THE STORE IS ONE READER'S, like the feed's memory: a different reader is a
// ranking that has not been fetched yet, never someone else's figures.

import { useSyncExternalStore } from "react";

import type { HeldAnswer } from "@/lib/feed/derive";

/**
 * What a score slot shows for a thing.
 *
 * - `figure`: a computed score, the ranker's exact value.
 * - `dash`: no figure is computed — a lookup miss, or a trace that found no
 *   paths (FeedEntryMoved.md:5).
 * - `settling`: the thing has not landed, so it has no figure by construction
 *   (item 90); its compact slot stands bare and its trace makes no fetch.
 */
export type Standing =
  | { readonly kind: "figure"; readonly score: number }
  | { readonly kind: "dash" }
  | { readonly kind: "settling" };

const DASH_STANDING: Standing = { kind: "dash" };
const SETTLING: Standing = { kind: "settling" };

type Held = {
  readonly reader: string | null;
  readonly answer: HeldAnswer;
  /** Whose view the answer ranked: the reader's own actor, or the borrowed vantage (CD-5). */
  readonly viewer: string;
};

let held: Held | null = null;
/** Per thing: the score its trace's fetch found, null where it found no paths. */
let adopted = new Map<string, number | null>();
let version = 0;
const listeners = new Set<() => void>();

function changed(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/**
 * A feed fetch landed (`RankedFeed.refresh`): its answer becomes the lookup
 * source and every adoption is dropped. A null answer — no rankable viewer —
 * holds nothing.
 */
export function holdRanking(reader: string | null, answer: HeldAnswer | null, viewer: string | null): void {
  held = answer === null || viewer === null ? null : { reader, answer, viewer };
  adopted = new Map();
  changed();
}

/** A trace's live fetch found `score` for `targetId` (null: no paths). */
export function adoptTrace(targetId: string, score: number | null): void {
  adopted.set(targetId, score);
  changed();
}

function heldFor(reader: string | null): Held | null {
  return held !== null && held.reader === reader ? held : null;
}

/**
 * The viewer whose feed fetch the reader's figures came from, or null with no
 * ranking held for `reader` (CD-SR1: a trace keeps the view its figure was
 * computed in, so an adopted figure is the same view's).
 */
export function heldViewer(reader: string | null): string | null {
  return heldFor(reader)?.viewer ?? null;
}

/**
 * A thing's standing for `reader`. `pending` is the thing's own landing state
 * as its row carries it; a thing the held answer lists as settling is
 * settling too.
 */
export function standingOf(reader: string | null, targetId: string, pending: boolean): Standing {
  const answer = heldFor(reader)?.answer ?? null;
  if (pending || (answer?.settling.some((row) => row.targetId === targetId) ?? false)) {
    return SETTLING;
  }
  if (adopted.has(targetId)) {
    const score = adopted.get(targetId) ?? null;
    return score === null ? DASH_STANDING : { kind: "figure", score };
  }
  const entry = answer?.entries.find((row) => row.targetId === targetId);
  return entry === undefined ? DASH_STANDING : { kind: "figure", score: entry.score };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): number {
  return version;
}

/** Re-renders the caller whenever a ranking is held or a trace adopts. */
export function useStandingVersion(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Forget everything — a cold start, for a test. */
export function forgetStandings(): void {
  held = null;
  adopted = new Map();
  changed();
}
