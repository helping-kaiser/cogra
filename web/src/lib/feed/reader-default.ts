// THE READER'S DEFAULT (SettingsReading.md; FeedSheet.md:59-61; FeedFilter.jsx
// "THE DEFAULT IS THE READER'S"): the filter every feed opens with, set in
// Settings' What your feed shows sheet — CoGra's own (`FEED_FILTER_DEFAULT`)
// until the reader sets theirs.
//
// IT STAYS ON THIS DEVICE (SettingsReading.md: "ALWAYS the reader's saved
// default stays on this device"; ranked-feed packet CD-6: "The default lives
// on the device, so it is never sent"). So it is browser storage, kept per
// account under the `cogra.` prefix Settings' erase clears, beside search's
// committed filter (`search-filter.ts`) — never a `setPreferences` field.
//
// A default never holds a topic: the settings sheet draws no topic section
// (FeedFilter.jsx, "A default never holds one").
//
// Read through `useSyncExternalStore` (React's documented hook for a browser
// store), so the feed's trigger, the Settings row and search all re-read
// the moment Done saves — in this tab by the store's own notice, in another
// by the `storage` event.

import { useSyncExternalStore } from "react";

import type { FeedOrder, FeedPeople, FeedPeopleSign } from "./derive";
import {
  FEED_ALSO,
  FEED_FILTER_DEFAULT,
  FEED_FORMS,
  FEED_KINDS,
  type FeedAlsoValue,
  type FeedFilterValue,
  type FeedFormValue,
  type FeedKindValue,
} from "./feed-filter";

const PREFIX = "cogra.feed.default.";

function keyOf(account: string): string {
  return `${PREFIX}${account}`;
}

function isOneOf<T extends string>(set: readonly { readonly value: T }[], value: unknown): value is T {
  return set.some((entry) => entry.value === value);
}

function listOf<T extends string>(set: readonly { readonly value: T }[], raw: unknown): T[] | null {
  if (!Array.isArray(raw) || !raw.every((value) => isOneOf(set, value))) return null;
  // In the sheet's order, each once.
  return set.map((entry) => entry.value).filter((value) => (raw as unknown[]).includes(value));
}

/** A stored value read back, or null where it is not one this build can hold. */
export function parseReaderDefault(raw: string): FeedFilterValue | null {
  let value: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return null;
    value = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const kinds = listOf<FeedKindValue>(FEED_KINDS, value.kinds);
  const forms = listOf<FeedFormValue>(FEED_FORMS, value.forms);
  const also = listOf<FeedAlsoValue>(FEED_ALSO, value.also);
  const order = value.order;
  const people = value.people;
  const sign = value.peopleSign;
  if (kinds === null || forms === null || also === null) return null;
  if (order !== "ranked" && order !== "newest") return null;
  if (typeof value.seen !== "boolean") return null;
  if (people !== "everyone" && people !== "yourPeople") return null;
  if (sign !== "for" && sign !== "against" && sign !== "either") return null;
  return {
    kinds,
    forms,
    order: order satisfies FeedOrder,
    seen: value.seen,
    also,
    topic: null,
    people: people satisfies FeedPeople,
    peopleSign: sign satisfies FeedPeopleSign,
  };
}

// One parsed value per raw string, so `useSyncExternalStore`'s snapshot is
// stable between reads of the same storage (React requires it).
const parsedFor = new Map<string, FeedFilterValue | null>();

function snapshotOf(account: string | null): FeedFilterValue {
  if (account === null || typeof window === "undefined") return FEED_FILTER_DEFAULT;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(keyOf(account));
  } catch {
    return FEED_FILTER_DEFAULT;
  }
  if (raw === null) return FEED_FILTER_DEFAULT;
  if (!parsedFor.has(raw)) parsedFor.set(raw, parseReaderDefault(raw));
  return parsedFor.get(raw) ?? FEED_FILTER_DEFAULT;
}

/**
 * `account`'s default: theirs where they set one on this device, else
 * CoGra's. A guest has no Settings, so a guest's is always CoGra's.
 */
export function readReaderDefault(account: string | null): FeedFilterValue {
  return snapshotOf(account);
}

const listeners = new Set<() => void>();

/** Saves `value` as `account`'s default on this device (SettingsReading.md, Done). */
export function writeReaderDefault(account: string, value: FeedFilterValue): void {
  if (typeof window === "undefined") return;
  const kept = { ...value, topic: null };
  try {
    window.localStorage.setItem(keyOf(account), JSON.stringify(kept));
  } catch {
    // A full or blocked storage keeps nothing; the row reads what stands.
  }
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The reader's default, kept current as Settings saves it. */
export function useReaderDefault(account: string | null): FeedFilterValue {
  return useSyncExternalStore(
    subscribe,
    () => snapshotOf(account),
    // The server renders CoGra's: storage is the browser's.
    () => FEED_FILTER_DEFAULT,
  );
}
