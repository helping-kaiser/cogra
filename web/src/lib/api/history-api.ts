// The seen-list's write, lifted into an outcome (api-spec.md "Private viewer
// state", `markSeen`) — authenticated-only, never member-gated: an
// applicant's seeing counts like a member's.

import type { ApolloClient } from "@apollo/client";

import { MarkSeenDocument } from "@/__generated__/graphql";
import { payloadOutcome, type Outcome } from "./outcome";

/** Records first seeings, in the order they were seen. */
export function markSeen(client: ApolloClient, nodes: readonly string[]): Promise<Outcome<true>> {
  return payloadOutcome(
    () => client.mutate({ mutation: MarkSeenDocument, variables: { nodes: [...nodes] } }),
    (data) => data.markSeen.userErrors,
    (data) => (data.markSeen.ok === true ? true : null),
  );
}
