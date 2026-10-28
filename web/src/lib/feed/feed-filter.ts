// THE FEED FILTER'S VALUE, how the trigger reads it back, and which of its
// axes reach the ranker.
//
// The shape is the drawn sheet's (design/components/navigation/FeedFilter.jsx
// `FEED_FILTER_DEFAULT`), axis for axis, so the sheet hands this module
// exactly what the board's component holds. The value is the record's word;
// labels are the sheet's. The one departure is the topic: the board keys it by
// the tag's name, and the wire by the Hashtag's id, so the value carries both
// — the id the ranker is asked with, the name the trigger speaks.
//
// TWO KINDS OF AXIS (ranked-feed packet §5.1; PR-49). `kinds` and `topic`
// change what the ranker must compute, so they ride `feedRanking(filter:)`.
// Every other axis — order, people and sign, seen, Still settling, and the
// forms / sensitive / removed predicates — is applied on the device to the
// held answer. That split is what decides a Done (CD-1): a Done that touched
// `kinds` or `topic` ranks once; one that touched only device axes re-derives
// from the answer already held and asks the server nothing.

import type { NodeKind } from "@/__generated__/graphql";
import type { DeviceCuts, FeedOrder, FeedPeople, FeedPeopleSign } from "./derive";

export type FeedKindValue = "posts" | "comments" | "profiles" | "topics";
export type FeedFormValue = "text" | "photos" | "video";
export type FeedAlsoValue = "sensitive" | "removed" | "settling";

/** The one topic the feed is narrowed to: the Hashtag's id and its own name. */
export type FeedTopic = {
  readonly id: string;
  /** The tag's name without its `#`. */
  readonly name: string;
};

export type FeedFilterValue = {
  readonly kinds: readonly FeedKindValue[];
  readonly forms: readonly FeedFormValue[];
  readonly order: FeedOrder;
  /** Show what you've already seen. */
  readonly seen: boolean;
  readonly also: readonly FeedAlsoValue[];
  /** At most one topic. A reader's default never holds one. */
  readonly topic: FeedTopic | null;
  readonly people: FeedPeople;
  /** Kept while `people` is Everyone, for Your people's return (FeedSheet.md:27). */
  readonly peopleSign: FeedPeopleSign;
};

/**
 * CoGra's own default (FeedFilter.jsx `FEED_FILTER_DEFAULT`; FeedSheet.md:43):
 * Posts, every form, RANKED, seen rows below the line, Still settling woven
 * in (PR-35), Sensitive and Removed off, everyone, Either.
 *
 * The order is Ranked: the ranker has shipped (SettingsReading.md's "Newest
 * GIVEN the ranker has not shipped" no longer binds).
 */
export const FEED_FILTER_DEFAULT: FeedFilterValue = {
  kinds: ["posts"],
  forms: ["text", "photos", "video"],
  order: "ranked",
  seen: false,
  also: ["settling"],
  topic: null,
  people: "everyone",
  peopleSign: "either",
};

type Labelled<T extends string> = readonly { readonly value: T; readonly label: string }[];

/**
 * `FEED_KINDS` (FeedFilter.jsx): the kinds V1.0 serves (FeedSheet.md:3), in
 * the sheet's order. `topics` keys the kind the graph carries; `Tags` is the
 * reader's word.
 */
export const FEED_KINDS: Labelled<FeedKindValue> = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "profiles", label: "Profiles" },
  { value: "topics", label: "Tags" },
];

/** `FEED_FORMS` (FeedFilter.jsx). */
export const FEED_FORMS: Labelled<FeedFormValue> = [
  { value: "text", label: "Text" },
  { value: "photos", label: "Photos" },
  { value: "video", label: "Video" },
];

/** `FILTER_ORDER` (OrderSection.jsx). */
export const FEED_ORDERS: Labelled<FeedOrder> = [
  { value: "ranked", label: "Ranked" },
  { value: "newest", label: "Newest" },
];

/** `FEED_ALSO` (FeedFilter.jsx): the chip's label is the pending marker's own words. */
export const FEED_ALSO: Labelled<FeedAlsoValue> = [
  { value: "sensitive", label: "Sensitive" },
  { value: "removed", label: "Removed" },
  { value: "settling", label: "Still settling" },
];

/** `FEED_PEOPLE_SIGN` (FeedFilter.jsx). */
export const FEED_PEOPLE_SIGN: Labelled<FeedPeopleSign> = [
  { value: "for", label: "For" },
  { value: "against", label: "Against" },
  { value: "either", label: "Either" },
];

function labelOf<T extends string>(set: Labelled<T>, value: T): string {
  return set.find((entry) => entry.value === value)?.label ?? value;
}

/** The value/kind split (FeedFilter.jsx:57-72): the sheet's word, the wire's kind. */
export const KIND_OF: Record<FeedKindValue, NodeKind> = {
  posts: "POST",
  comments: "COMMENT",
  profiles: "USER",
  topics: "HASHTAG",
};

/** What `feedRanking(filter:)` carries: the ranker's arguments and nothing else. */
export type RankArguments = {
  readonly kinds: readonly NodeKind[];
  /** The topic's Hashtag id. */
  readonly topic: string | null;
};

export function rankArgumentsOf(filter: FeedFilterValue): RankArguments {
  return {
    // In the sheet's own order, so one filter is always one request.
    kinds: FEED_KINDS.filter((kind) => filter.kinds.includes(kind.value)).map((kind) => KIND_OF[kind.value]),
    topic: filter.topic?.id ?? null,
  };
}

/** What the derive reads off the filter. */
export function deviceCutsOf(filter: FeedFilterValue): DeviceCuts {
  return {
    order: filter.order,
    showSeen: filter.seen,
    showSettling: filter.also.includes("settling"),
    people: filter.people,
    peopleSign: filter.peopleSign,
  };
}

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

/** Whether two values ask the ranker the same question. */
export function sameRankArguments(a: FeedFilterValue, b: FeedFilterValue): boolean {
  return sameSet(a.kinds, b.kinds) && (a.topic?.id ?? null) === (b.topic?.id ?? null);
}

/** Whether two values hold the same filter, axis by axis. */
export function sameFilter(a: FeedFilterValue, b: FeedFilterValue): boolean {
  return (
    sameRankArguments(a, b) &&
    sameSet(a.forms, b.forms) &&
    a.order === b.order &&
    a.seen === b.seen &&
    sameSet(a.also, b.also) &&
    a.people === b.people &&
    a.peopleSign === b.peopleSign
  );
}

/**
 * What a Done does (CD-1, split by PR-49): nothing changed → nothing
 * (FeedSheet.md:83); `kinds` or `topic` changed → one ranking, then the
 * derive (a mixed Done included); only device axes changed → a local
 * re-derive from the held answer, with no call and no new pin.
 */
export type DoneEffect = "nothing" | "rederive" | "rank";

export function doneEffectOf(applied: FeedFilterValue, staged: FeedFilterValue): DoneEffect {
  if (sameFilter(applied, staged)) return "nothing";
  return sameRankArguments(applied, staged) ? "rederive" : "rank";
}

/** A chip's tap on a combining axis: on joins, off leaves, in the sheet's order. */
export function toggled<T extends string>(set: Labelled<T>, held: readonly T[], value: T): T[] {
  const next = held.includes(value) ? held.filter((entry) => entry !== value) : [...held, value];
  return set.map((entry) => entry.value).filter((entry) => next.includes(entry));
}

// THE TRIGGER'S TYPE, MEASURED (FeedFilter.jsx `measureTriggerText`). What
// overflows the band is a width, so the summary measures itself in the type it
// renders in: per-character advances of Figtree at the wght=500 instance
// `--text-label-large` paints at, in font units. The table is the master's own
// — `_build/report-summaries.mjs --print-metrics` writes it there and fails the
// design pipeline if it drifts from the font — copied character for character.

/** What the `CograBand` leaves the pill's words (FeedFilter.jsx `BAND_CEILING_PX`). */
export const BAND_CEILING_PX = 154;

const TRIGGER_FONT_SIZE_PX = 14;
const TRIGGER_UNITS_PER_EM = 1000;
const TRIGGER_LETTER_SPACING_PX = 0.1;
const TRIGGER_ALPHABET =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·";
const TRIGGER_ADVANCES = [
  244.27, 301.75, 345.07, 629.43, 560.98, 793.06, 644.58, 212.1, 360.07, 360.07,
  482.59, 625.73, 234.64, 414.27, 218.95, 400.67, 642.87, 415.73, 564.19, 547.03,
  624.31, 576.3, 569.46, 542.33, 613.57, 569.46, 266.11, 271.39, 625.73, 625.73,
  625.73, 506.31, 989.72, 686.94, 611.15, 721.87, 691.03, 590.99, 546.17, 755.53,
  750.85, 275.75, 524.94, 625.27, 524.47, 848.74, 773.71, 779.17, 585.77, 782.02,
  630.9, 612.13, 561.22, 706.42, 700.78, 966.63, 632.0, 616.1, 638.27, 329.19,
  400.67, 329.19, 559.07, 437.13, 232.81, 516.29, 588.59, 542.15, 588.31, 548.26,
  375.77, 591.17, 561.45, 240.07, 274.62, 499.69, 227.2, 856.76, 560.88, 580.15,
  593.59, 581.46, 349.24, 466.0, 384.34, 560.88, 530.08, 798.12, 492.14, 539.97,
  487.54, 387.73, 257.14, 387.73, 594.94, 256.01,
];
const TRIGGER_ADVANCE = new Map([...TRIGGER_ALPHABET].map((character, index) => [character, TRIGGER_ADVANCES[index]!]));
const TRIGGER_ADVANCE_WIDEST = Math.max(...TRIGGER_ADVANCES);

/**
 * The words' width in px. A character the table does not carry measures as
 * its widest one: an unfamiliar glyph collapses the summary a word early,
 * never overflows the band.
 */
export function measureTriggerText(text: string): number {
  let units = 0;
  let characters = 0;
  for (const character of text) {
    units += TRIGGER_ADVANCE.get(character) ?? TRIGGER_ADVANCE_WIDEST;
    characters += 1;
  }
  return (units / TRIGGER_UNITS_PER_EM) * TRIGGER_FONT_SIZE_PX + characters * TRIGGER_LETTER_SPACING_PX;
}

/** The trigger's word for the one default-on chip switched off (FeedNarrowed.md:9). */
const SETTLED_ONLY = "settled only";

/**
 * Whose people the people extra names: the reader's own (`your people`), or
 * the borrowed view's account's (`@mira's people`, FeedSheet.md: "GIVEN the
 * feed borrows a view").
 */
export function peopleWord(borrowedHandle: string | null): string {
  return borrowedHandle === null ? "your people" : `@${borrowedHandle}'s people`;
}

/**
 * THE TRIGGER'S READING (FeedFilter.jsx `feedFilterSummary`; copy-voice *The
 * filter pill's state words*; FeedNarrowed.md, FeedTopic.md, FeedFar.md,
 * FeedNothing.md, FeedSheet.md:65-73).
 *
 * The head is the kinds, always: one kind's name, `2 kinds`, `All kinds`,
 * `Nothing`. Every other axis speaks only where it departs from `against` —
 * THE READER'S DEFAULT (CD-6), never the app's constant — and speaks its
 * STATE, never the direction, so a departure back toward the app's default
 * reads like any other: the topic first, then the people, the forms, the
 * order, the seen toggle, and the also-group. Spelled while they fit the
 * band's 154px; past it, the extras collapse to a count after the head, which
 * never collapses (`Posts · 3 changes`).
 */
export function feedFilterSummary(
  value: FeedFilterValue,
  against: FeedFilterValue = FEED_FILTER_DEFAULT,
  borrowedHandle: string | null = null,
  budgetPx: number = BAND_CEILING_PX,
): string {
  const kinds = value.kinds;
  const head =
    kinds.length === 0
      ? "Nothing"
      : kinds.length === 1
        ? labelOf(FEED_KINDS, kinds[0]!)
        : kinds.length === FEED_KINDS.length
          ? "All kinds"
          : `${kinds.length} kinds`;
  const extras: string[] = [];
  // The topic leads the extras (FeedTopic.md:3), by the tag's own name, hash
  // and all. A default never holds one, so it has no back word.
  if (value.topic !== null) extras.push(`#${value.topic.name}`);
  // The people: a state departs when the row or, under Your people, the
  // sign does. Either adds nothing to the word (FeedSheet.md:71).
  const peopleDeparts =
    value.people !== against.people ||
    (value.people === "yourPeople" && value.peopleSign !== against.peopleSign);
  if (peopleDeparts && value.people === "yourPeople") {
    const word = peopleWord(borrowedHandle);
    extras.push(
      value.peopleSign === "either" ? word : `${word}, ${labelOf(FEED_PEOPLE_SIGN, value.peopleSign).toLowerCase()}`,
    );
  }
  // Everyone has no word in the master's table; a departure back to it from
  // a Your-people default reads `everyone`, the axis's state (Q2).
  if (peopleDeparts && value.people === "everyone") extras.push("everyone");
  // Every form off has no word in the master's table (`forms.length > 0`):
  // the head's kinds already say what the feed admits.
  if (value.forms.length > 0 && !sameSet(value.forms, against.forms)) {
    extras.push(
      value.forms.length === FEED_FORMS.length
        ? "all forms"
        : FEED_FORMS.filter((form) => value.forms.includes(form.value))
            .map((form) => form.label.toLowerCase())
            .join(" + "),
    );
  }
  if (value.order !== against.order) extras.push(labelOf(FEED_ORDERS, value.order).toLowerCase());
  if (value.seen !== against.seen) extras.push(value.seen ? "showing seen" : "hiding seen");
  const added = FEED_ALSO.filter((entry) => value.also.includes(entry.value) && !against.also.includes(entry.value));
  if (added.length > 0) extras.push(`+ ${added.map((entry) => entry.label.toLowerCase()).join(", ")}`);
  for (const entry of ["sensitive", "removed"] as const) {
    if (against.also.includes(entry) && !value.also.includes(entry)) extras.push(`hiding ${entry}`);
  }
  if (against.also.includes("settling") && !value.also.includes("settling")) extras.push(SETTLED_ONLY);
  if (extras.length === 0) return head;
  const spelled = [head, ...extras].join(" · ");
  if (measureTriggerText(spelled) <= budgetPx) return spelled;
  return `${head} · ${extras.length} ${extras.length === 1 ? "change" : "changes"}`;
}
