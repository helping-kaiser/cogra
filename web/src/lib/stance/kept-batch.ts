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
// ONE BATCH PER ACCOUNT. Several accounts share a tab (auth.md "Multi-account
// device custody"), and Close lets the reader switch while a batch signs, so
// each account's batch is kept apart, keyed by the account that pressed: its
// picks are that account's, dropped from that account's slot whoever is signed
// in when it lands; its lines stand only under that account — hidden under
// another, standing again under its own, never erased by a switch nor by
// another account's batch — and its Retry does nothing under another account.
// Within an account the seal's commit refuses a second press until the
// signing answers (KeptPicksSeal.md:25), so a batch that account presses while
// one still signs joins the one in flight rather than preparing a second.

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

/** One account's batch. */
type Batch = {
  state: KeptBatchState | null;
  /** The targets the state is about. */
  targets: ReadonlySet<string>;
  closed: boolean;
  inFlight: Promise<Outcome<StanceCommit>> | null;
};

/** Each account's batch, by the account that pressed. */
const batches = new Map<string, Batch>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function publish(owner: string, batch: Batch, next: KeptBatchState | null): void {
  batch.state = next;
  if (next === null && batch.inFlight === null) batches.delete(owner);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribeAccounts = tokenStore.subscribe(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeAccounts();
  };
}

/** The active account's batch, if it has one. */
function active(): Batch | null {
  const account = tokenStore.activeAccountId();
  return account === null ? null : (batches.get(account) ?? null);
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
 * Signs the kept batch for the active account and answers what it came to.
 * Closed before the answer (`closeKeptBatchSeal`), the answer is the batch's
 * readers' instead: taken, it lands; anything else stands as Settings' failed
 * line with a Retry that asks the same batch again.
 */
export function signKeptBatch(
  commit: Commit,
  entries: readonly KeptEntry[],
  { fromRow = false }: { fromRow?: boolean } = {},
): Promise<Outcome<StanceCommit>> {
  const by = tokenStore.activeAccountId();
  // No account, no batch to keep: nothing outlives the screen.
  if (by === null) return commit(entries);
  const existing = batches.get(by);
  if (existing?.inFlight) return existing.inFlight;
  const batch: Batch = existing ?? { state: null, targets: new Set(), closed: false, inFlight: null };
  batches.set(by, batch);
  // A Retry on Settings' row has no seal to answer to.
  batch.closed = fromRow;
  batch.targets = new Set(entries.map((entry) => keyOf(entry.target)));
  const run = (async () => {
    const outcome = await commit(entries).catch(
      (cause: unknown): Outcome<StanceCommit> => ({ kind: "failed", cause }),
    );
    if (outcome.kind === "success") {
      // Taken: the rows' wait goes at once, and the picks leave their slot.
      batch.state = null;
      notify();
      await land(by, entries);
      batch.inFlight = null;
      publish(by, batch, null);
      return outcome;
    }
    batch.inFlight = null;
    if (!batch.closed) {
      publish(by, batch, null);
    } else {
      publish(by, batch, {
        kind: "failed",
        retry: () => {
          if (tokenStore.activeAccountId() !== by || batch.inFlight !== null) return;
          void signKeptBatch(commit, entries, { fromRow: true });
        },
      });
    }
    return outcome;
  })();
  batch.inFlight = run;
  publish(by, batch, { kind: "signing", closed: batch.closed });
  return run;
}

/**
 * The seal closed while its batch signs: the batch's readers take the answer.
 * `owner` is the account the seal pressed as; the active one by default.
 */
export function closeKeptBatchSeal(owner: string | null = tokenStore.activeAccountId()): void {
  const batch = owner === null ? undefined : batches.get(owner);
  if (owner === null || batch === undefined || batch.state?.kind !== "signing" || batch.closed) return;
  batch.closed = true;
  publish(owner, batch, { kind: "signing", closed: true });
}

/** The active account's batch, outside React; null where nothing stands. */
export function readKeptBatch(): KeptBatchState | null {
  return active()?.state ?? null;
}

/** The active account's batch; null where nothing stands. */
export function useKeptBatch(): KeptBatchState | null {
  return useSyncExternalStore(subscribe, readKeptBatch, () => null);
}

/** Whether `target`'s row reads `Signing…` for the closed seal's batch (KeptPicksSeal.md:59, :63). */
export function keptBatchSigning(target: StanceTarget): boolean {
  const batch = active();
  return batch?.state?.kind === "signing" && batch.closed && batch.targets.has(keyOf(target));
}

export function useKeptBatchSigning(target: StanceTarget): boolean {
  return useSyncExternalStore(subscribe, () => keptBatchSigning(target), () => false);
}

export function resetKeptBatchForTests(): void {
  batches.clear();
}
