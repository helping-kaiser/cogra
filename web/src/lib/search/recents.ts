"use client";

// EXPLORE'S RECENT SEARCHES (Explore.md:21-33; digest item 26).
//
// KEPT ON THE DEVICE AND NEVER AS A RECORD (:21): `localStorage`, under the
// `cogra.` prefix so Settings' erase takes them with every other choice kept
// here (`erase-everything.ts`). PER ACCOUNT (:31): each signed-in account keeps
// its own list under its own key, and a guest's lives under the guest key —
// on the device alone, never carried into an account. CLEARED AT SIGN-OUT
// (:31): the settings page drops the leaving account's list on every
// sign-out, so a shared browser never shows the next reader what the last
// one looked for.
//
// TEN KEPT, NEWEST FIRST, AND A QUERY MET AGAIN IN ANY CASE MOVES TO THE TOP
// AND NEVER STANDS TWICE (:27). The query is kept as it was last typed.
//
// Every mounted reader re-renders when the list changes, in this tab or
// another, through `useSyncExternalStore` (`device-preference.ts`'s
// construction).

import { useCallback, useSyncExternalStore } from "react";

/** How many recent searches are kept (Explore.md:27). */
export const RECENTS_KEPT = 10;

const PREFIX = "cogra.explore.recents.";
const GUEST = "guest";

/** The storage key of `account`'s list; null is the guest's. */
export function recentsKey(account: string | null): string {
  return `${PREFIX}${account ?? GUEST}`;
}

const listeners = new Set<() => void>();
const EMPTY: readonly string[] = [];
// `useSyncExternalStore` needs a stable snapshot: the parsed list is cached
// against the raw string it came from.
const parsed = new Map<string, { raw: string | null; list: readonly string[] }>();

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** `account`'s recent searches, newest first. */
export function readRecents(account: string | null): readonly string[] {
  const store = storage();
  if (store === null) return EMPTY;
  const key = recentsKey(account);
  const raw = store.getItem(key);
  const cached = parsed.get(key);
  if (cached !== undefined && cached.raw === raw) return cached.list;
  let list: readonly string[] = EMPTY;
  if (raw !== null) {
    try {
      const value: unknown = JSON.parse(raw);
      if (Array.isArray(value)) {
        list = value.filter((entry): entry is string => typeof entry === "string").slice(0, RECENTS_KEPT);
      }
    } catch {
      // A damaged entry reads as no recents rather than as a fault.
    }
  }
  parsed.set(key, { raw, list });
  return list;
}

function notify(): void {
  // `storage` fires in OTHER tabs only, so this tab is told directly.
  for (const listener of listeners) listener();
}

/**
 * The list with `query` written in: trimmed, at the top, any earlier entry
 * equal to it case aside dropped, ten kept. A blank query changes nothing.
 */
export function withRecent(list: readonly string[], query: string): readonly string[] {
  const asked = query.trim();
  if (asked === "") return list;
  const folded = asked.toLocaleLowerCase();
  return [asked, ...list.filter((entry) => entry.toLocaleLowerCase() !== folded)].slice(0, RECENTS_KEPT);
}

/** Writes `query` into `account`'s recent searches (Explore.md:23, :25). */
export function rememberSearch(account: string | null, query: string): void {
  const store = storage();
  if (store === null) return;
  const next = withRecent(readRecents(account), query);
  try {
    store.setItem(recentsKey(account), JSON.stringify(next));
  } catch {
    // A full or blocked storage keeps the list it had; recents are a comfort.
    return;
  }
  notify();
}

/** Drops `account`'s recent searches — the sign-out's (Explore.md:31). */
export function forgetRecents(account: string | null): void {
  const store = storage();
  if (store === null) return;
  try {
    store.removeItem(recentsKey(account));
  } catch {
    return;
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** `account`'s recent searches, live, with the writer bound to the same account. */
export function useRecents(account: string | null): [readonly string[], (query: string) => void] {
  const list = useSyncExternalStore(
    subscribe,
    () => readRecents(account),
    () => EMPTY,
  );
  const remember = useCallback((query: string) => rememberSearch(account, query), [account]);
  return [list, remember];
}

/**
 * The key a recent row is registered by (nodes.json, `explore.recent`): the
 * query's words lowercased, each run of other characters one `-`, none
 * leading or trailing.
 */
export function recentNodeKey(query: string): string {
  return query
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
