// THE FILTER COMMITTED IN THE FEED LASTS ON THIS DEVICE (FeedSheet.md:65-67;
// round 25's ruling): what the sheet's Done applied stands until the reader
// changes it — through a reload, a restart and a cold launch alike — and the
// feed opens with it. It never travels to another device and never changes
// the reader's saved default (`reader-default.ts`): a feed opens with the
// saved default only where no filter committed inside it stands here
// (SettingsReading.md:33).
//
// Browser storage, kept per account — a guest's under the guest key — under
// the `cogra.` prefix Settings' erase clears, beside search's committed filter
// (`search-filter.ts`). Unlike a default, a committed filter may hold a topic.
//
// Read through `useSyncExternalStore`, as the reader's default is, so a commit
// in another tab reaches this one by the `storage` event.

import { useSyncExternalStore } from "react";

import type { FeedFilterValue, FeedTopic } from "./feed-filter";
import { parseReaderDefault } from "./reader-default";

const PREFIX = "cogra.feed.committed.";

function keyOf(account: string | null): string {
  return `${PREFIX}${account ?? "guest"}`;
}

function topicOf(raw: unknown): FeedTopic | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return undefined;
  const { id, name } = raw as Record<string, unknown>;
  return typeof id === "string" && typeof name === "string" ? { id, name } : undefined;
}

/** A stored value read back, or null where it is not one this build can hold. */
export function parseCommittedFilter(raw: string): FeedFilterValue | null {
  const base = parseReaderDefault(raw);
  if (base === null) return null;
  let topic: FeedTopic | null | undefined;
  try {
    topic = topicOf((JSON.parse(raw) as Record<string, unknown>).topic);
  } catch {
    return null;
  }
  return topic === undefined ? null : { ...base, topic };
}

// One parsed value per raw string, so the snapshot is stable between reads of
// the same storage (React requires it of `useSyncExternalStore`).
const parsedFor = new Map<string, FeedFilterValue | null>();

function snapshotOf(account: string | null): FeedFilterValue | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(keyOf(account));
  } catch {
    return null;
  }
  if (raw === null) return null;
  if (!parsedFor.has(raw)) parsedFor.set(raw, parseCommittedFilter(raw));
  return parsedFor.get(raw) ?? null;
}

/** The filter `account` last committed in the feed on this device, or null. */
export function readCommittedFeedFilter(account: string | null): FeedFilterValue | null {
  return snapshotOf(account);
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Keeps `value` as the filter `account` committed in the feed (FeedSheet.md:65, Done). */
export function writeCommittedFeedFilter(account: string | null, value: FeedFilterValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyOf(account), JSON.stringify(value));
  } catch {
    // A full or blocked storage keeps the filter for this visit only.
  }
  notify();
}

/**
 * Lets the committed filter go, so the feed follows the saved default again —
 * FeedNothing's `Show posts again` ("the filter returns to its default").
 */
export function forgetCommittedFeedFilter(account: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyOf(account));
  } catch {
    // Nothing kept, nothing to let go.
  }
  notify();
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

/** The filter committed in the feed on this device, kept current; null where none stands. */
export function useCommittedFeedFilter(account: string | null): FeedFilterValue | null {
  return useSyncExternalStore(
    subscribe,
    () => snapshotOf(account),
    // The server renders none: storage is the browser's.
    () => null,
  );
}
