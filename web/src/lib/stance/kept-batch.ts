"use client";

// THE KEPT PICKS' BATCH — skeleton: today's behaviour, the seal awaiting the
// commit in the screen and nothing outliving it.

import type { Outcome } from "@/lib/api/outcome";
import type { KeptEntry, StanceCommit, StanceTarget } from "./stance-data";

export type KeptBatchState =
  | { readonly kind: "signing"; readonly closed: boolean }
  | { readonly kind: "failed"; readonly retry: () => void };

export function signKeptBatch(
  commit: (entries: readonly KeptEntry[]) => Promise<Outcome<StanceCommit>>,
  entries: readonly KeptEntry[],
): Promise<Outcome<StanceCommit>> {
  return commit(entries);
}

export function closeKeptBatchSeal(): void {}

export function readKeptBatch(): KeptBatchState | null {
  return null;
}

export function keptBatchSigning(target: StanceTarget): boolean {
  void target;
  return false;
}

export function resetKeptBatchForTests(): void {}
