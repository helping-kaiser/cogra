// The seen-list's write, lifted into an outcome (api-spec.md "Private viewer
// state", `markSeen`) — authenticated-only, never member-gated: an
// applicant's seeing counts like a member's.

import type { ApolloClient } from "@apollo/client";

import { MarkSeenDocument, ViewHistoryIdsDocument } from "@/__generated__/graphql";
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
