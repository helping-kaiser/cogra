// The Saved list, lifted into outcomes (api-spec.md "Private viewer state",
// `User.bookmarks`, `setBookmark`, `removeBookmark`). Authenticated-only and
// never member-gated: an applicant keeps things like a member.

import type { ApolloClient } from "@apollo/client";

import {
  RemoveBookmarkDocument,
  SavedPageDocument,
  SetBookmarkDocument,
  type SavedPageQuery,
} from "@/__generated__/graphql";
import { payloadOutcome, success, viewerField, type Outcome } from "./outcome";

type SavedEdge = NonNullable<
  NonNullable<SavedPageQuery["me"]>["bookmarks"]
>["edges"][number];

/** One kept thing, as the Saved page's read serves it. */
export type SavedNode = SavedEdge["node"];

/** One row of the Saved list: the thing, and when the reader kept it. */
export type SavedEntry = {
  readonly node: SavedNode;
  /** When the reader saved it — the list's order, the row's age, Undo's restore time. */
  readonly bookmarkedAt: string;
};

/** A page of the reader's own Saved list, newest first by save time. */
export type SavedPage = {
  readonly items: readonly SavedEntry[];
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

/**
 * A page of the reader's own Saved list. A null `me` is the shared
 * UNAUTHENTICATED refusal, so the auth guard refreshes a stale token and
 * replays.
 */
export async function fetchSavedPage(
  client: ApolloClient,
  after: string | null,
): Promise<Outcome<SavedPage>> {
  const fetched = await viewerField(
    () =>
      client.query({
        query: SavedPageDocument,
        variables: { after },
        fetchPolicy: "network-only",
      }),
    (data) => data.me?.bookmarks,
  );
  if (fetched.kind !== "success") return fetched;
  const page = fetched.value;
  return success({
    items: page.edges.map((edge) => ({ node: edge.node, bookmarkedAt: edge.bookmarkedAt })),
    endCursor: page.pageInfo.endCursor ?? null,
    hasNextPage: page.pageInfo.hasNextPage,
  });
}

/**
 * Keeps a node; succeeds with when it was kept. `at` restores a removed row's
 * own time, which is how Undo puts the row back where it was.
 */
export function setBookmark(
  client: ApolloClient,
  node: string,
  at: string | null = null,
): Promise<Outcome<string>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: SetBookmarkDocument,
        variables: { node, bookmarkedAt: at },
      }),
    (data) => data.setBookmark.userErrors,
    (data) => data.setBookmark.bookmark?.bookmarkedAt ?? null,
  );
}

/** Drops a node from the Saved list; dropping one not kept is ok. */
export function removeBookmark(client: ApolloClient, node: string): Promise<Outcome<true>> {
  return payloadOutcome(
    () => client.mutate({ mutation: RemoveBookmarkDocument, variables: { node } }),
    (data) => data.removeBookmark.userErrors,
    (data) => (data.removeBookmark.ok === true ? true : null),
  );
}
