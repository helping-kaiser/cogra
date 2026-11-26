"use client";

// THE KEPT PICKS' BATCH, still signing after its seal was closed, and what
// became of it (KeptPicksSeal.md:57-63, Settings.md:205-207,
// SigningAfterClose.md). The pattern is `profile/profile-change.ts`'s.
//
// WHY A MODULE STORE. From the press on `Sign the picks` every way out reads
// `Close` and only closes the seal: "the batch goes on as a whole" and "NEVER
// the act is cancelled" (KeptPicksSeal.md:59). The signing outlives the
// screen that started it, so it runs HERE; the seal, Settings' kept-picks row
// and each target's row only read it. While the seal is open it owns the
// answer — its own fault states, its own leaving — and no line stands
// anywhere else; once it has closed, each target's row reads `Signing…` while
// the batch signs, and a batch that did not go through stands on Settings'
// row as `That didn't sign.` with Retry, which asks the WHOLE batch again
// through the same commit (so the batch slot's same-signing rule holds).
//
// A BATCH TAKEN is the picks' landing wherever it answers (KeptPicksSeal.md:31):
// they are kept no longer, each target settles, and the snackbar counts the
// batch — the open seal then leaves on its own.
//
// One batch at a time: the seal's commit refuses a second press until the
// signing answers (KeptPicksSeal.md:25), so a batch pressed while one still
// signs joins the one in flight rather than preparing a second.
//
// The batch is the pressing account's (auth.md "Multi-account device
// custody"): its picks are that account's, dropped from that account's slot
// whoever is signed in when it lands; its lines stand only under that account
// — hidden under another, standing again under its own, never erased by a
// switch — and its Retry does nothing under another account.

import { useSyncExternalStore } from "react";

import type { Outcome } from "@/lib/api/outcome";
import { tokenStore } from "@/lib/session/token-store";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";
import { dropKeptPicks } from "./kept-picks";
import { markSettling } from "./settling";
import { announceStanceSigned } from "./signed-events";
import type { KeptEntry, StanceCommit, StanceTarget } from "./stance-data";

/** What the batch's readers see. */
export type KeptBatchState =
  | { readonly kind: "signing"; readonly closed: boolean }
  | { readonly kind: "failed"; readonly retry: () => void };

type Commit = (entries: readonly KeptEntry[]) => Promise<Outcome<StanceCommit>>;

/** The settled snackbar in its batch form: `Signed 3 things, still settling.` */
export function signedBatchLine(count: number): string {
  return `Signed ${count} ${count === 1 ? "thing" : "things"}, still settling.`;
}

const keyOf = (target: StanceTarget) => `${target.kind}:${target.id}`;

let state: KeptBatchState | null = null;
/** The targets of the batch the state is about. */
let targets: ReadonlySet<string> = new Set();
/** The account the tab was signed in as when the batch was pressed. */
let owner: string | null = null;
let closed = false;
let inFlight: Promise<Outcome<StanceCommit>> | null = null;
const listeners = new Set<() => void>();

const isOwners = () => owner !== null && tokenStore.activeAccountId() === owner;

function publish(next: KeptBatchState | null): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribeAccounts = tokenStore.subscribe(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeAccounts();
  };
}

/** The batch landed: its picks are kept no longer, and the owner sees it settle. */
async function land(by: string, entries: readonly KeptEntry[]): Promise<void> {
  const signed = entries.map((entry) => entry.target);
  if (tokenStore.activeAccountId() === by) {
    markSettling(signed);
    announceStanceSigned();
    carrySnackbar(signedBatchLine(entries.length));
  }
  await dropKeptPicks(by, signed);
}

/**
 * Signs the kept batch and answers what it came to. Closed before the answer
 * (`closeKeptBatchSeal`), the answer is the batch's readers' instead: taken,
 * it lands; anything else stands as Settings' failed line with a Retry that
 * asks the same batch again.
 */
export function signKeptBatch(
  commit: Commit,
  entries: readonly KeptEntry[],
  { fromRow = false }: { fromRow?: boolean } = {},
): Promise<Outcome<StanceCommit>> {
  if (inFlight !== null) return inFlight;
  const by = tokenStore.activeAccountId();
  owner = by;
  // A Retry on Settings' row has no seal to answer to.
  closed = fromRow;
  targets = new Set(entries.map((entry) => keyOf(entry.target)));
  publish({ kind: "signing", closed });
  const run = (async () => {
    const outcome = await commit(entries).catch(
      (cause: unknown): Outcome<StanceCommit> => ({ kind: "failed", cause }),
    );
    if (outcome.kind === "success") {
      // Taken: the rows' wait goes at once, and the picks leave their slot.
      publish(null);
      if (by !== null) await land(by, entries);
      inFlight = null;
      return outcome;
    }
    inFlight = null;
    if (!closed) {
      publish(null);
    } else {
      publish({
        kind: "failed",
        retry: () => {
          if (!isOwners() || inFlight !== null) return;
          void signKeptBatch(commit, entries, { fromRow: true });
        },
      });
    }
    return outcome;
  })();
  inFlight = run;
  return run;
}

/** The seal closed while its batch signs: the batch's readers take the answer. */
export function closeKeptBatchSeal(): void {
  if (state?.kind !== "signing" || closed) return;
  closed = true;
  publish({ kind: "signing", closed: true });
}

/** The batch as its owner's readers see it, outside React; null where nothing stands. */
export function readKeptBatch(): KeptBatchState | null {
  return isOwners() ? state : null;
}

/** The batch as its owner's readers see it; null where nothing stands. */
export function useKeptBatch(): KeptBatchState | null {
  return useSyncExternalStore(subscribe, readKeptBatch, () => null);
}

/** Whether `target`'s row reads `Signing…` for the closed seal's batch (KeptPicksSeal.md:59, :63). */
export function keptBatchSigning(target: StanceTarget): boolean {
  const now = readKeptBatch();
  return now?.kind === "signing" && now.closed && targets.has(keyOf(target));
}

export function useKeptBatchSigning(target: StanceTarget): boolean {
  return useSyncExternalStore(subscribe, () => keptBatchSigning(target), () => false);
}

export function resetKeptBatchForTests(): void {
  state = null;
  targets = new Set();
  owner = null;
  closed = false;
  inFlight = null;
}
