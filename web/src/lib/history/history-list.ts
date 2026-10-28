// HISTORY'S LIST LAWS, as plain functions (History.md, HistoryFilter.md,
// HistorySearch.md): the kinds the filter narrows to and the words its
// trigger reads, the day dividers, and how a narrowed read stands in
// sections. No React in it, so each law is tested as a function.

import type { NodeKind } from "@/__generated__/graphql";
import { KIND_OF, type FeedKindValue } from "@/lib/feed/feed-filter";

/**
 * THE HISTORY'S FILTER KINDS ARE THE FEED FILTER'S OWN LIST
 * (HistoryFilter.md:5; `FeedFilter.jsx` `FEED_KINDS`): the value is the
 * record's word, the label the screen's.
 */
export const HISTORY_KINDS: readonly { readonly value: FeedKindValue; readonly label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "profiles", label: "Profiles" },
  { value: "topics", label: "Tags" },
];

/** What the trigger reads with nothing narrowed — search's word (History.md:105). */
export const EVERYTHING = "Everything";

/**
 * The trigger's reading (History.md:105; HistoryFilter.md:31): `Everything`
 * at the default, else the narrowed kinds in the filter pill's state words —
 * one kind's name, `2 kinds`, or `All kinds` (copy-voice, *The filter pill's
 * state words*). The order of the chips never changes the words.
 */
export function kindsReading(kinds: readonly FeedKindValue[]): string {
  if (kinds.length === 0) return EVERYTHING;
  if (kinds.length === 1) return HISTORY_KINDS.find((kind) => kind.value === kinds[0])?.label ?? EVERYTHING;
  if (kinds.length === HISTORY_KINDS.length) return "All kinds";
  return `${kinds.length} kinds`;
}

/**
 * The read's `kinds`: null with no chip on — every kind History serves
 * (HistoryFilter.md:9) — else the narrowed kinds, in the sheet's order.
 */
export function nodeKindsOf(kinds: readonly FeedKindValue[]): NodeKind[] | null {
  if (kinds.length === 0) return null;
  return HISTORY_KINDS.filter((kind) => kinds.includes(kind.value)).map((kind) => KIND_OF[kind.value]);
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dayKey(at: Date): string {
  return `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
}

/**
 * THE DAY DIVIDER'S WORDS (History.md:25; copy-voice *Ages*, History's
 * exception): `Today`, `Yesterday`, then the dateline's date — `2 October`,
 * the year added only when it is not the current one. Days are the reader's
 * own, in the device's time zone.
 */
export function dayLabel(iso: string, now: number = Date.now()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const today = new Date(now);
  if (dayKey(at) === dayKey(today)) return "Today";
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (dayKey(at) === dayKey(yesterday)) return "Yesterday";
  const date = `${at.getDate()} ${MONTHS[at.getMonth()]}`;
  return at.getFullYear() === today.getFullYear() ? date : `${date} ${at.getFullYear()}`;
}

/** The divider's registered key: its words, lowercased, each run of other characters one `-`. */
export function dayNodeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A divider above the first thing first seen on each day; null between two of one day. */
export function dividersOf(seenAt: readonly string[], now: number = Date.now()): (string | null)[] {
  let last = "";
  return seenAt.map((iso) => {
    const label = dayLabel(iso, now);
    if (label === last) return null;
    last = label;
    return label;
  });
}

/** Which section of a narrowed History a thing stands in (HistorySearch.md:3-23). */
export type HistorySection = "people" | "tags" | "content";

export function sectionOf(typename: string): HistorySection {
  if (typename === "User") return "people";
  if (typename === "Hashtag") return "tags";
  return "content";
}
