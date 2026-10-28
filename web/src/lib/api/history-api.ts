// The seen-list, lifted into outcomes (api-spec.md "Private viewer state",
// `markSeen`, `User.viewHistory`) — authenticated-only, never member-gated:
// an applicant's seeing counts like a member's, and so does their History.

import type { ApolloClient } from "@apollo/client";

import {
  HistoryPageDocument,
  MarkSeenDocument,
  ViewHistoryIdsDocument,
  type HistoryPageQuery,
  type NodeKind,
} from "@/__generated__/graphql";
import { payloadOutcome, success, viewerField, type Outcome } from "./outcome";

/** One thing on the reader's seen-list, as the sync reads it: the id and when it was first seen. */
export type SeenEntry = { readonly id: string; readonly firstSeenAt: string };

/** A page of the reader's own seen-list, newest first. */
export type SeenPage = {
  readonly items: readonly SeenEntry[];
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

/**
 * A page of the reader's own `viewHistory`, ids only (history-surface F5's
 * cheap form; PR-52's sync). A null `me` is the shared UNAUTHENTICATED
 * refusal, so the auth guard refreshes a stale token and replays.
 */
export async function fetchSeenPage(
  client: ApolloClient,
  after: string | null,
): Promise<Outcome<SeenPage>> {
  const fetched = await viewerField(
    () =>
      client.query({
        query: ViewHistoryIdsDocument,
        variables: { after },
        fetchPolicy: "network-only",
      }),
    (data) => data.me?.viewHistory,
  );
  if (fetched.kind !== "success") return fetched;
  const history = fetched.value;
  return success({
    items: history.edges.map((edge) => ({ id: edge.node.id, firstSeenAt: edge.firstSeenAt })),
    endCursor: history.pageInfo.endCursor ?? null,
    hasNextPage: history.pageInfo.hasNextPage,
  });
}

/** Records first seeings, in the order they were seen. */
export function markSeen(client: ApolloClient, nodes: readonly string[]): Promise<Outcome<true>> {
  return payloadOutcome(
    () => client.mutate({ mutation: MarkSeenDocument, variables: { nodes: [...nodes] } }),
    (data) => data.markSeen.userErrors,
    (data) => (data.markSeen.ok === true ? true : null),
  );
}

type HistoryEdge = NonNullable<NonNullable<HistoryPageQuery["me"]>["viewHistory"]>["edges"][number];

/** One seen thing, as History's read serves it. */
export type HistoryNode = HistoryEdge["node"];
/** A seen post: the feed card's own `FeedPost`. */
export type HistoryPost = Extract<HistoryNode, { __typename: "Post" }>;
/** A seen comment: the thread's `CommentFields`, what it answers, and its thread's post. */
export type HistoryComment = Extract<HistoryNode, { __typename: "Comment" }>;
/** A seen person, as the profile card draws them. */
export type HistoryPerson = Extract<HistoryNode, { __typename: "User" }>;
/** A seen topic, as the tag card draws it. */
export type HistoryTopic = Extract<HistoryNode, { __typename: "Hashtag" }>;

/** One row of History: the thing, and when the reader first saw it. */
export type HistoryEntry = {
  readonly node: HistoryNode;
  /** The list's order — never a card's age (History.md:31). */
  readonly firstSeenAt: string;
};

/** A page of the reader's own History, newest first by first seeing. */
export type HistoryPage = {
  readonly items: readonly HistoryEntry[];
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
  /** More people match than the people section serves: `See all profiles`. */
  readonly hasMorePeople: boolean;
  /** More topics match than the tags section serves: `See all tags`. */
  readonly hasMoreTags: boolean;
};

/**
 * A page of the reader's own History (`User.viewHistory`), narrowed by
 * `kinds` (null = every kind History serves) and by `query` — the one search
 * law over the seen set, run on the server. A blank query narrows nothing and
 * is sent as null. A narrowed list pages on cursors of its own, so `after`
 * must come from a page read with the same `query` and `kinds`. A null `me`
 * is the shared UNAUTHENTICATED refusal, so the auth guard refreshes a stale
 * token and replays.
 */
export async function fetchHistoryPage(
  client: ApolloClient,
  after: string | null,
  query: string,
  kinds: readonly NodeKind[] | null,
): Promise<Outcome<HistoryPage>> {
  const narrowed = query.trim();
  const fetched = await viewerField(
    () =>
      client.query({
        query: HistoryPageDocument,
        variables: { after, query: narrowed === "" ? null : narrowed, kinds: kinds === null ? null : [...kinds] },
        fetchPolicy: "network-only",
      }),
    (data) => data.me?.viewHistory,
  );
  if (fetched.kind !== "success") return fetched;
  const page = fetched.value;
  return success({
    items: page.edges.map((edge) => ({ node: edge.node, firstSeenAt: edge.firstSeenAt })),
    endCursor: page.pageInfo.endCursor ?? null,
    hasNextPage: page.pageInfo.hasNextPage,
    hasMorePeople: page.hasMorePeople,
    hasMoreTags: page.hasMoreTags,
  });
}
