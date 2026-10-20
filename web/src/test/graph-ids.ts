// The graph-id reads every signing surface makes before it prepares
// (graph-ids-api.ts), answered by default under every MSW server so a test
// about something else need not know the intent check exists. Every id is
// content, and its L1 identifier is `testGraphId(id)` — a test that pins an
// expectation computes the same string.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";

/** The L1 identifier the default handler serves for an L2 id. */
export function testGraphId(id: string): string {
  return `mint:test:${id}`;
}

export const GRAPH_IDS = [
  gqlLink.query("ContentGraphIds", ({ variables }) =>
    HttpResponse.json({
      data: {
        nodes: (variables.ids as string[]).map((id) => ({
          __typename: "Post",
          id,
          graphId: testGraphId(id),
        })),
      },
    }),
  ),
  gqlLink.query("UserGraphId", ({ variables }) =>
    HttpResponse.json({
      data: {
        user: { __typename: "User", id: variables.id, graphId: testGraphId(variables.id as string) },
      },
    }),
  ),
];
