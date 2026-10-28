// The ranked feed's two reads (api-spec.md `feedRanking`, `feed`; ranked-feed
// packet §4.1, §4.4), lifted into outcomes. Both are public reads: the viewer
// is explicit, and the pod down is the server's INTERNAL, which lands here as
// `failed` — the feed never falls back to another listing (§4.5).

import type { ApolloClient } from "@apollo/client";

import {
  FeedCardsDocument,
  FeedDocument,
  FeedRankingDocument,
  type FeedCardsQuery,
  type FeedQuery,
  type NodeKind,
} from "@/__generated__/graphql";
import type { HeldAnswer } from "@/lib/feed/derive";
import type { RankArguments } from "@/lib/feed/feed-filter";
import { fetchOutcome, success, type Outcome } from "./outcome";

/** The ranked feed's Post row — the same `FeedPost` selection the card reads. */
export type FeedPostView = Extract<FeedQuery["feed"]["edges"][number]["node"], { __typename: "Post" }>;

/** A comment, a person or a topic, as its own feed card draws it (`FeedCards`). */
export type FeedCardView = Exclude<FeedCardsQuery["feed"]["edges"][number]["node"], { __typename: "Post" }>;

export type FeedCommentView = Extract<FeedCardView, { __typename: "Comment" }>;
export type FeedPersonView = Extract<FeedCardView, { __typename: "User" }>;
export type FeedTopicView = Extract<FeedCardView, { __typename: "Hashtag" }>;

/** One hydrated row, of whichever kind the reader let in. */
export type FeedItemView = FeedPostView | FeedCardView;

/**
 * One ranking of `viewer`'s view under the ranker's arguments. Null when
 * the viewer resolves to no rankable actor.
 */
export async function fetchFeedRanking(
  client: ApolloClient,
  viewer: string,
  args: RankArguments,
): Promise<Outcome<HeldAnswer | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: FeedRankingDocument,
      variables: { viewer, kinds: [...args.kinds], topic: args.topic },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const ranking = fetched.value.feedRanking;
  if (!ranking) return success(null);
  return success({
    asOfEpoch: ranking.asOfEpoch,
    entries: ranking.entries.map(({ targetId, kind, score, mark, newestIndex }) => ({
      targetId,
      kind,
      score,
      mark: mark ?? null,
      newestIndex,
    })),
    settling: ranking.settling.map(({ targetId, kind, mark, rankedPosition, newestPosition }) => ({
      targetId,
      kind,
      mark: mark ?? null,
      rankedPosition,
      newestPosition,
    })),
  });
}

/** How many of the other kinds' ids one `FeedCards` read carries (its literal `first: 10`). */
export const FEED_CARDS_PAGE = 10;

/**
 * Hydrates one window of a derived list, in the order handed (at most a page
 * of ids). The ranking already named each row's kind, so the post rows ride
 * `Feed` and the other kinds `FeedCards`, a page of ten at a time; the answer
 * is put back in the order handed. An id the server cannot hydrate — a
 * pending write that expired — is simply absent from the answer.
 *
 * `kinds` runs beside `ids`, one per id; where it is shorter, a row is read
 * as a post — the only kind a feed held before the others were let in.
 */
export async function fetchFeedWindow(
  client: ApolloClient,
  ids: readonly string[],
  kinds: readonly NodeKind[] = [],
): Promise<Outcome<readonly FeedItemView[]>> {
  const postIds = ids.filter((_, index) => (kinds[index] ?? "POST") === "POST");
  const otherIds = ids.filter((_, index) => (kinds[index] ?? "POST") !== "POST");
  const found = new Map<string, FeedItemView>();
  if (postIds.length > 0) {
    const fetched = await fetchOutcome(() =>
      client.query({
        query: FeedDocument,
        variables: { orderedIds: postIds, first: postIds.length },
        fetchPolicy: "network-only",
      }),
    );
    if (fetched.kind !== "success") return fetched;
    for (const { node } of fetched.value.feed.edges) {
      if (node.__typename === "Post") found.set(node.id, node);
    }
  }
  for (let at = 0; at < otherIds.length; at += FEED_CARDS_PAGE) {
    const page = otherIds.slice(at, at + FEED_CARDS_PAGE);
    const fetched = await fetchOutcome(() =>
      client.query({
        query: FeedCardsDocument,
        variables: { orderedIds: page },
        fetchPolicy: "network-only",
      }),
    );
    if (fetched.kind !== "success") return fetched;
    for (const { node } of fetched.value.feed.edges) {
      if (node.__typename !== "Post") found.set(node.id, node);
    }
  }
  return success(ids.map((id) => found.get(id)).filter((item): item is FeedItemView => item !== undefined));
}
