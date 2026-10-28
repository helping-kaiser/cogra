// THE SEARCH FILTER'S VALUE, and how the trigger reads it back
// (ExploreFilter.md; design/designs/canonical/screens/ExploreFilter.jsx;
// design/components/navigation/FeedFilter.jsx `FEED_KINDS`, OrderSection.jsx).
//
// THE KINDS ARE THE FEED FILTER'S OWN LIST (ExploreFilter.md:3) — Posts,
// Comments, Profiles, Tags — but their SEMANTICS ARE SEARCH'S: no chip on means
// every kind (ExploreFilter.md:7), where the feed's empty set means nothing. So
// the value and the wire share the feed's words (`feed-filter.ts`) and the
// reading is search's own (FeedFilter.jsx: "search draws its own, with its own
// kind semantics").
//
// THE ORDER AND THE SEEN TOGGLE ARE THE READER'S DEFAULT (ExploreFilter.md:11-15,
// the one default object, fix-fix ruling 12): the default set in Settings, the
// app's until the reader sets their own. Settings' Reading row draws no editor
// yet on the web (`settings-view.tsx`, `reading.feed`), so the reader's default
// IS the app's — Ranked, seen off — and `readerSearchDefault` says so in one
// place for the day the row ships.

import type { NodeKind, ReadOrder } from "@/__generated__/graphql";
import type { FeedKindValue } from "@/lib/feed/feed-filter";

export type SearchOrder = "ranked" | "newest";

export type SearchFilterValue = {
  /** The kinds on; none on reads every kind. */
  readonly kinds: readonly FeedKindValue[];
  readonly order: SearchOrder;
  /** Show what you've already seen. */
  readonly seen: boolean;
};

/** `FEED_KINDS` (FeedFilter.jsx:69-74): the value is the record's word, the label the reader's. */
export const SEARCH_KINDS: readonly { readonly value: FeedKindValue; readonly label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "profiles", label: "Profiles" },
  { value: "topics", label: "Tags" },
];

/** `FILTER_ORDER` (OrderSection.jsx:23-26). */
export const SEARCH_ORDERS: readonly { readonly value: SearchOrder; readonly label: string }[] = [
  { value: "ranked", label: "Ranked" },
  { value: "newest", label: "Newest" },
];

/** CoGra's own default for search's shared axes (ExploreFilter.md:15). */
export const APP_SEARCH_DEFAULT: SearchFilterValue = { kinds: [], order: "ranked", seen: false };

/**
 * The reader's default (ExploreFilter.md:11-13): no kind narrowed, the order
 * and the seen toggle at the reader's own feed-filter default — the app's,
 * until Settings' Reading row ships its editor.
 */
export function readerSearchDefault(): SearchFilterValue {
  return APP_SEARCH_DEFAULT;
}

/**
 * A GUEST'S SEARCH (ExploreSearch.md:65; ExploreFilter.md:41, digest item 28):
 * newest first, no rank, no seen toggle — there is no viewpoint to rank from
 * and no seen-list to keep out.
 */
export function guestSearchFilter(kinds: readonly FeedKindValue[] = []): SearchFilterValue {
  return { kinds, order: "newest", seen: true };
}

const KIND_OF: Record<FeedKindValue, NodeKind> = {
  posts: "POST",
  comments: "COMMENT",
  profiles: "USER",
  topics: "HASHTAG",
};

/** The wire's `kinds`: null when none is on (every served kind, api-spec "Search"). */
export function wireKinds(kinds: readonly FeedKindValue[]): NodeKind[] | null {
  if (kinds.length === 0) return null;
  // In the list's own order, so one filter is always one request.
  return SEARCH_KINDS.filter((kind) => kinds.includes(kind.value)).map((kind) => KIND_OF[kind.value]);
}

/** The wire's `order`. */
export function wireOrder(order: SearchOrder): ReadOrder {
  return order === "ranked" ? "RANKED" : "NEWEST";
}

function labelOf(kind: FeedKindValue): string {
  return SEARCH_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

/**
 * The trigger's reading (ExploreFilter.md:17; ExploreSearch.md:17;
 * ExploreUnscoped.md:9). The head is the kinds: `Everything` with none on —
 * search's word for nothing narrowed (copy-voice.md, the filter's state
 * words) — the one kind's name with one on, `All kinds` with all four, else
 * the count (`2 kinds`). Then only the deviations from `against`, the reader's
 * default, in the feed filter's words: `newest` / `ranked` for the order (a
 * deviation back toward the app's default is a deviation too), `showing seen`
 * / `hiding seen` for the toggle.
 */
export function searchFilterSummary(
  value: SearchFilterValue,
  against: SearchFilterValue = readerSearchDefault(),
): string {
  const kinds = value.kinds;
  const head =
    kinds.length === 0
      ? "Everything"
      : kinds.length === 1
        ? labelOf(kinds[0]!)
        : kinds.length === SEARCH_KINDS.length
          ? "All kinds"
          : `${kinds.length} kinds`;
  const extras: string[] = [];
  if (value.order !== against.order) extras.push(value.order);
  if (value.seen !== against.seen) extras.push(value.seen ? "showing seen" : "hiding seen");
  return [head, ...extras].join(" · ");
}

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

/** Whether two filters ask the same question. */
export function sameSearchFilter(a: SearchFilterValue, b: SearchFilterValue): boolean {
  return sameSet(a.kinds, b.kinds) && a.order === b.order && a.seen === b.seen;
}

/** A kind chip's tap: on joins, off leaves; the list's order is kept. */
export function toggleKind(kinds: readonly FeedKindValue[], kind: FeedKindValue): FeedKindValue[] {
  const next = kinds.includes(kind) ? kinds.filter((entry) => entry !== kind) : [...kinds, kind];
  return SEARCH_KINDS.map((entry) => entry.value).filter((value) => next.includes(value));
}
