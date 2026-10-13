// THE FEED FILTER'S VALUE, and which of its axes reach the ranker.
//
// The shape is the drawn sheet's (design/components/navigation/FeedFilter.jsx
// :67-119, `FEED_FILTER_DEFAULT` at :96), word for word, so the sheet that
// builds on it (BD-2) hands this module exactly what the board's component
// holds. The value is the record's word; labels are the sheet's business.
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

export type FeedFilterValue = {
  readonly kinds: readonly FeedKindValue[];
  readonly forms: readonly FeedFormValue[];
  readonly order: FeedOrder;
  /** Show what you've already seen. */
  readonly seen: boolean;
  readonly also: readonly FeedAlsoValue[];
  /** At most one topic: a Hashtag id. */
  readonly topic: string | null;
  readonly people: FeedPeople;
  /** Kept while `people` is Everyone, for Your people's return (FeedSheet.md:27). */
  readonly peopleSign: FeedPeopleSign;
};

/**
 * CoGra's own default (FeedFilter.jsx:96): Posts, every form, RANKED, seen
 * rows cut, Still settling woven in (PR-35), everyone, Either.
 *
 * The order is Ranked from the day the ranked path ships (§4.9): the interim
 * Newest `posts` listing that stood in for it before is retired with it.
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

/** The value/kind split (FeedFilter.jsx:57-72): the sheet's word, the wire's kind. */
const KIND_OF: Record<FeedKindValue, NodeKind> = {
  posts: "POST",
  comments: "COMMENT",
  profiles: "USER",
  topics: "HASHTAG",
};

/** What `feedRanking(filter:)` carries: the ranker's arguments and nothing else. */
export type RankArguments = {
  readonly kinds: readonly NodeKind[];
  readonly topic: string | null;
};

export function rankArgumentsOf(filter: FeedFilterValue): RankArguments {
  return { kinds: filter.kinds.map((kind) => KIND_OF[kind]), topic: filter.topic };
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
  return sameSet(a.kinds, b.kinds) && a.topic === b.topic;
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
