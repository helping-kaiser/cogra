"use client";

// A PICK KEPT PENDING (PadKeyAbsent.md, PadPending.md; the key-loss round).
// With the signing key elsewhere nothing is signed and nothing is staged
// server-side — but a reader who pressed `Keep it pending, restore later`
// made a pick and kept it, and the target's anchor has to say so or the pick
// reads as lost.
//
// - It lives on THIS DEVICE ONLY and survives a restart: `localStorage`, the
//   device-local construction the input mode and the reading settings use.
// - ONE PER TARGET: a new pick kept on the same target replaces the old one;
//   several targets can wait at once.
// - Per account, so a second account on the browser never wears the first
//   one's picks.
// - Only `Keep it pending` keeps one; leaving the pad any other way drops it.
//
// Every mounted reader re-renders when a pick is kept, through
// `useSyncExternalStore`.

import { useCallback, useSyncExternalStore } from "react";

import type { StancePair } from "./model";
import type { StanceTarget } from "./stance-data";

const PREFIX = "cogra.keptPicks.";

type Kept = Readonly<Record<string, StancePair>>;

const listeners = new Set<() => void>();
const EMPTY: Kept = {};
/** The last parse per raw string, so a snapshot is stable between changes. */
let cache: { raw: string | null; value: Kept } = { raw: null, value: EMPTY };

const keyOf = (target: StanceTarget) => `${target.kind}:${target.id}`;

function read(account: string): Kept {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PREFIX + account);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.value;
  let value: Kept = EMPTY;
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object") value = parsed as Kept;
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

/** The pick kept toward `target` on this device, or null. */
export function keptPick(account: string | null, target: StanceTarget): StancePair | null {
  if (account === null) return null;
  return read(account)[keyOf(target)] ?? null;
}

/** Keeps `pick` toward `target`, replacing whatever was kept there. */
export function keepPick(account: string, target: StanceTarget, pick: StancePair): void {
  const next = { ...read(account), [keyOf(target)]: pick };
  try {
    window.localStorage.setItem(PREFIX + account, JSON.stringify(next));
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The pick kept toward `target`, live; and the way to keep one. */
export function useKeptPick(
  account: string | null,
  target: StanceTarget,
): [StancePair | null, (pick: StancePair) => void] {
  const kept = useSyncExternalStore(
    subscribe,
    () => keptPick(account, target),
    () => null,
  );
  const keep = useCallback(
    (pick: StancePair) => {
      if (account !== null) keepPick(account, target, pick);
    },
    [account, target],
  );
  return [kept, keep];
}
