// The ranked feed's two reads (api-spec.md `feedRanking`, `feed`; ranked-feed
// packet §4.1, §4.4), lifted into outcomes. Both are public reads: the viewer
// is explicit, and the pod down is the server's INTERNAL, which lands here as
// `failed` — the feed never falls back to another listing (§4.5).

import type { ApolloClient } from "@apollo/client";

import {
  FeedDocument,
  FeedRankingDocument,
  type FeedQuery,
} from "@/__generated__/graphql";
import type { HeldAnswer } from "@/lib/feed/derive";
import type { RankArguments } from "@/lib/feed/feed-filter";
import { fetchOutcome, success, type Outcome } from "./outcome";

/** One hydrated row: a Post as the card draws it, or another kind by id. */
export type FeedItemView = FeedQuery["feed"]["edges"][number]["node"];

/** The ranked feed's Post row — the same `FeedPost` selection the card reads. */
export type FeedPostView = Extract<FeedItemView, { __typename: "Post" }>;

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

/**
 * Hydrates one window of a derived list, in the order handed (at most a page
 * of ids). An id the server cannot hydrate — a pending write that expired —
 * is simply absent from the answer.
 */
export async function fetchFeedWindow(
  client: ApolloClient,
  ids: readonly string[],
): Promise<Outcome<readonly FeedItemView[]>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: FeedDocument,
      variables: { orderedIds: [...ids], first: ids.length },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  return success(fetched.value.feed.edges.map((edge) => edge.node));
}
