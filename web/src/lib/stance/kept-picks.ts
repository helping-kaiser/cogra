"use client";

// A PICK KEPT PENDING (PadKeyAbsent.md, PadPending.md, PadPendingReview.md,
// KeptPicksReview.md). With the signing key elsewhere nothing is signed and
// nothing is staged server-side — but a reader who pressed `Keep it pending,
// restore later` made a pick and kept it, and the target's anchor has to say
// so or the pick reads as lost. Once the key is back the kept opinions sign
// together, from the review's own seal, never on their own.
//
// - It lives on THIS DEVICE ONLY and survives a restart.
// - ONE PER TARGET: a new pick kept on the same target replaces the old one;
//   several targets can wait at once.
// - Only `Keep it pending` keeps one; leaving the pad any other way drops it.
// - PER ACCOUNT, and THE DRAFT'S CUSTODY TIER (auth.md "Sign-out", "Device
//   lock"; web.md "Key custody"): the rows ride the compose draft's own store
//   under their own keys, beside the sealed copies and the carried
//   expectations (`carried.ts` is the pattern), so a device lock locks them
//   with the draft, an unlock puts them back (`draft-custody.ts`), a
//   don't-remember sign-out clears them with the draft, and a remembered
//   sign-out keeps every one. A session ended elsewhere never destroys one.
// - A KEPT VOUCH-BACK OR APPROVAL IS NOT A KEPT OPINION (KeptPicksReview.md:5,
//   VouchBackPad.md:49, VouchAskPad.md:29): it is kept with its family named,
//   so the review — which lists plain opinions only — never takes it into the
//   batch.
//
// Every mounted reader re-renders when a pick is kept or dropped, through
// `useSyncExternalStore`; another tab hears it on a `BroadcastChannel`.

import { useEffect, useSyncExternalStore } from "react";

import { open, STORE } from "@/lib/compose/draft-store";
import type { StancePair } from "./model";
import type { StanceTarget, StanceTargetKind } from "./stance-data";

/** What a kept pick will sign as once the key is back. */
export type KeptFamily = "opinion" | "vouchBack" | "approval";

export type KeptPick = {
  readonly target: StanceTarget;
  readonly pick: StancePair;
  readonly family: KeptFamily;
  /** When it was kept — the review lists the picks in the order they were made. */
  readonly keptAt: number;
};

/** The stored shape's version — what lets a later build say "not a shape I read". */
const KEPT_SCHEMA = 1;

type KeptRecord = {
  readonly v: typeof KEPT_SCHEMA;
  readonly kind: StanceTargetKind;
  readonly id: string;
  readonly pDirected: number;
  readonly pInterest: number;
  readonly family: KeptFamily;
  readonly keptAt: number;
};

const PREFIX = "kept:";
/** The first stand-in (#281) kept its picks in localStorage; adopted once, then dropped. */
const LEGACY_PREFIX = "cogra.keptPicks.";
const CHANNEL = "cogra.keptPicks";

const KINDS: ReadonlySet<string> = new Set(["post", "comment", "profile", "topic"]);
const FAMILIES: ReadonlySet<string> = new Set(["opinion", "vouchBack", "approval"]);

function keptKey(account: string, target: StanceTarget): string {
  return `${PREFIX}${account}:${target.kind}:${target.id}`;
}

/** Every key of this account's kept picks, and nothing else in the store. */
export function keptRange(account: string): IDBKeyRange {
  return IDBKeyRange.bound(`${PREFIX}${account}:`, `${PREFIX}${account}:￿`);
}

export function sameTarget(a: StanceTarget, b: StanceTarget): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function recordOf(value: unknown): KeptPick | null {
  if (value === null || typeof value !== "object") return null;
  const r = value as Partial<KeptRecord>;
  if (r.v !== KEPT_SCHEMA) return null;
  if (typeof r.kind !== "string" || !KINDS.has(r.kind) || typeof r.id !== "string") return null;
  if (typeof r.pDirected !== "number" || typeof r.pInterest !== "number") return null;
  if (typeof r.family !== "string" || !FAMILIES.has(r.family)) return null;
  return {
    target: { kind: r.kind, id: r.id },
    pick: { pDirected: r.pDirected, pInterest: r.pInterest },
    family: r.family,
    keptAt: typeof r.keptAt === "number" ? r.keptAt : 0,
  };
}

function transact<T>(
  idb: IDBFactory,
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => () => T,
): Promise<T> {
  return open(idb).then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        try {
          const transaction = db.transaction(STORE, mode);
          const result = body(transaction.objectStore(STORE));
          transaction.oncomplete = () => {
            db.close();
            resolve(result());
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error ?? new Error("the kept picks transaction aborted"));
          };
        } catch (e) {
          db.close();
          reject(e);
        }
      }),
  );
}

/** The persisted kept picks; every call names its account. */
export type KeptPickStore = {
  /** The account's kept picks, oldest first. */
  list(account: string): Promise<KeptPick[]>;
  /** Keeps `pick` toward `target`, replacing whatever was kept there. */
  keep(account: string, target: StanceTarget, pick: StancePair, family: KeptFamily): Promise<void>;
  /** Drops the picks kept toward `targets` (a review's ×, a signed batch). */
  drop(account: string, targets: readonly StanceTarget[]): Promise<void>;
  /** Drops every pick of the account (the don't-remember sign-out). */
  forget(account: string): Promise<void>;
};

export function createKeptPickStore(deps: { idb: () => IDBFactory }): KeptPickStore {
  const factory = deps.idb;
  return {
    list(account) {
      return transact(factory(), "readonly", (store) => {
        const picks: KeptPick[] = [];
        const cursor = store.openCursor(keptRange(account));
        cursor.onsuccess = () => {
          const at = cursor.result;
          if (at === null) return;
          const pick = recordOf(at.value);
          if (pick !== null) picks.push(pick);
          at.continue();
        };
        return () => picks.sort((a, b) => a.keptAt - b.keptAt);
      });
    },

    async keep(account, target, pick, family) {
      await transact(factory(), "readwrite", (store) => {
        store.put(
          {
            v: KEPT_SCHEMA,
            kind: target.kind,
            id: target.id,
            pDirected: pick.pDirected,
            pInterest: pick.pInterest,
            family,
            keptAt: Date.now(),
          } satisfies KeptRecord,
          keptKey(account, target),
        );
        return () => undefined;
      });
    },

    async drop(account, targets) {
      await transact(factory(), "readwrite", (store) => {
        for (const target of targets) store.delete(keptKey(account, target));
        return () => undefined;
      });
    },

    async forget(account) {
      await transact(factory(), "readwrite", (store) => {
        store.delete(keptRange(account));
        return () => undefined;
      });
    },
  };
}

// ---- the live layer ----------------------------------------------------------

let idbFactory: () => IDBFactory = () => indexedDB;
let store: KeptPickStore = createKeptPickStore({ idb: () => idbFactory() });
const cache = new Map<string, readonly KeptPick[]>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

function broadcast(account: string): void {
  try {
    channel ??= typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
    channel?.postMessage({ account });
  } catch {
    // another tab catches up on its next mount
  }
}

/** Moves the localStorage stand-in's picks into custody, once, then drops the stand-in. */
async function adoptLegacy(account: string): Promise<void> {
  if (typeof window === "undefined") return;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LEGACY_PREFIX + account);
  } catch {
    return;
  }
  if (raw === null) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        const at = key.indexOf(":");
        const kind = key.slice(0, at);
        const pair = value as Partial<StancePair> | null;
        if (at < 0 || !KINDS.has(kind) || pair === null) continue;
        if (typeof pair.pDirected !== "number" || typeof pair.pInterest !== "number") continue;
        await store.keep(
          account,
          { kind: kind as StanceTargetKind, id: key.slice(at + 1) },
          { pDirected: pair.pDirected, pInterest: pair.pInterest },
          "opinion",
        );
      }
    }
  } catch {
    // an unreadable stand-in has nothing to adopt
  }
  try {
    window.localStorage.removeItem(LEGACY_PREFIX + account);
  } catch {
    // dropped on the next load
  }
}

/** Re-reads the account's picks; overlapping calls share one read. */
export function refreshKeptPicks(account: string): Promise<void> {
  const running = inFlight.get(account);
  if (running !== undefined) return running;
  const run = (async () => {
    try {
      await adoptLegacy(account);
      cache.set(account, await store.list(account));
    } catch {
      // custody unreachable: nothing is known to be kept
      cache.set(account, cache.get(account) ?? []);
    } finally {
      inFlight.delete(account);
    }
    notify();
  })();
  inFlight.set(account, run);
  return run;
}

async function changed(account: string): Promise<void> {
  inFlight.delete(account);
  await refreshKeptPicks(account);
  broadcast(account);
}

/** Keeps a pick toward `target` for `account` — the pad's `Keep it pending, restore later`. */
export async function keepPick(
  account: string,
  target: StanceTarget,
  pick: StancePair,
  family: KeptFamily = "opinion",
): Promise<void> {
  await store.keep(account, target, pick, family);
  await changed(account);
}

/** Drops the picks kept toward `targets`. */
export async function dropKeptPicks(account: string, targets: readonly StanceTarget[]): Promise<void> {
  await store.drop(account, targets);
  await changed(account);
}

/** Drops every pick the account keeps here (the don't-remember sign-out). */
export async function forgetKeptPicks(account: string): Promise<void> {
  await store.forget(account);
  await changed(account);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  let hear: BroadcastChannel | null = null;
  try {
    hear = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
  } catch {
    hear = null;
  }
  if (hear !== null) {
    hear.onmessage = (event: MessageEvent<{ account?: unknown }>) => {
      if (typeof event.data?.account === "string") void refreshKeptPicks(event.data.account);
    };
  }
  return () => {
    listeners.delete(listener);
    hear?.close();
  };
}

/**
 * The account's kept picks, live — every family, oldest first; null until
 * the first read answers, or with nobody signed in. Each mount re-reads, so a
 * lock or an unlock in between is never served from a stale copy.
 */
export function useKeptPicks(account: string | null): readonly KeptPick[] | null {
  const picks = useSyncExternalStore(
    subscribe,
    () => (account === null ? null : (cache.get(account) ?? null)),
    () => null,
  );
  useEffect(() => {
    if (account !== null) void refreshKeptPicks(account);
  }, [account]);
  return picks;
}

/** The kept plain opinions — what the review lists and the seal signs. */
export function keptOpinions(picks: readonly KeptPick[] | null): readonly KeptPick[] {
  return picks === null ? [] : picks.filter((pick) => pick.family === "opinion");
}

/** A fresh, empty custody for each test, and nothing remembered from the last. */
export function resetKeptPicksForTests(factory: () => IDBFactory): void {
  idbFactory = factory;
  store = createKeptPickStore({ idb: () => idbFactory() });
  cache.clear();
  inFlight.clear();
  channel?.close();
  channel = null;
}
