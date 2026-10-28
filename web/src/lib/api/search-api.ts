// The global search, lifted into outcomes (api-spec.md "Search", `Query.search`).
// A public read: a guest searches too, and a signed-in reader's token rides
// along so `includeSeen` and `RANKED` have a session to read.

import type { ApolloClient } from "@apollo/client";

import { SearchDocument, type NodeKind, type ReadOrder, type SearchQuery } from "@/__generated__/graphql";
import { fetchOutcome, success, type Outcome } from "./outcome";

type SearchEdge = SearchQuery["search"]["edges"][number];

/** One result, as the union serves it. */
export type SearchNode = SearchEdge["node"];
export type SearchPost = Extract<SearchNode, { __typename: "Post" }>;
export type SearchComment = Extract<SearchNode, { __typename: "Comment" }>;
export type SearchPerson = Extract<SearchNode, { __typename: "User" }>;
export type SearchTag = Extract<SearchNode, { __typename: "Hashtag" }>;

/** One result and the viewer's score of it — null past a seam and under NEWEST. */
export type SearchHit = {
  readonly node: SearchNode;
  readonly score: number | null;
};

export type SearchPage = {
  readonly hits: readonly SearchHit[];
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
  /** The See all profiles door (api-spec "The people section"). */
  readonly hasMorePeople: boolean;
};

export type SearchAsk = {
  readonly query: string;
  /** Null narrows nothing. */
  readonly kinds: readonly NodeKind[] | null;
  readonly includeSeen: boolean;
  readonly order: ReadOrder;
  /** The reader, for RANKED; null under NEWEST. */
  readonly viewer: string | null;
};

/**
 * A page of `ask`'s results. A page continues the ask its first page
 * answered, so `after` must come from a page read with the same ask.
 */
export async function fetchSearchPage(
  client: ApolloClient,
  ask: SearchAsk,
  after: string | null,
): Promise<Outcome<SearchPage>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: SearchDocument,
      variables: {
        query: ask.query,
        kinds: ask.kinds === null ? null : [...ask.kinds],
        includeSeen: ask.includeSeen,
        order: ask.order,
        viewer: ask.order === "RANKED" ? ask.viewer : null,
        after,
      },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const page = fetched.value.search;
  return success({
    hits: page.edges.map((edge) => ({ node: edge.node, score: edge.score ?? null })),
    endCursor: page.pageInfo.endCursor ?? null,
    hasNextPage: page.pageInfo.hasNextPage,
    hasMorePeople: page.hasMorePeople,
  });
}
