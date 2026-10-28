"use client";

// THE KEPT PICKS JUST SIGNED, STILL SETTLING (PadPendingReview.md:21,
// KeptPicksSeal.md: "each target's anchor wears Still settling until its
// record is ordered"). The seal names the targets it signed; each one's anchor
// then says `Still settling` under its face until a read that leaves pending
// records out counts as many records as the one that includes them — the
// record is ordered — and drops it.
//
// Memory only, for this page: a reload reads the standing afresh, and a
// signed record's place in the order is the server's to say, not the device's.

import { useSyncExternalStore } from "react";

import type { StanceTarget } from "./stance-data";

const keyOf = (target: StanceTarget) => `${target.kind}:${target.id}`;

let settling: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function publish(next: ReadonlySet<string>): void {
  settling = next;
  for (const listener of listeners) listener();
}

/** The seal's batch was taken: each of these targets is settling. */
export function markSettling(targets: readonly StanceTarget[]): void {
  publish(new Set([...settling, ...targets.map(keyOf)]));
}

/** The target's record is ordered. */
export function clearSettling(target: StanceTarget): void {
  if (!settling.has(keyOf(target))) return;
  const next = new Set(settling);
  next.delete(keyOf(target));
  publish(next);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettling(target: StanceTarget): boolean {
  const key = keyOf(target);
  return useSyncExternalStore(
    subscribe,
    () => settling.has(key),
    () => false,
  );
}

export function resetSettlingForTests(): void {
  settling = new Set();
}
