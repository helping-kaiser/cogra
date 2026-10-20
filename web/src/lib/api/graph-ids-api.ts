// The raw L1 identifiers of the nodes a gesture names (writes.graphql
// `ContentGraphIds`/`UserGraphId`; Android twin: GraphIdRepository). A form
// holds its targets by L2 id; the acts it signs name them by L1 id. The
// intent check (intent.ts) compares the two, so before a gesture's batch
// is prepared the device reads the L1 id of every node the form names —
// through the read surface, never through the prepare it is checking.
//
// A node's L1 id never changes once minted, so reading it at signing time
// is reading what was on screen.

import type { ApolloClient } from "@apollo/client";

import { ContentGraphIdsDocument, UserGraphIdDocument } from "@/__generated__/graphql";
import { failed, fetchOutcome, success, type Outcome } from "./outcome";

/** L2 id → raw L1 identifier, for every id asked about. */
export type GraphIds = ReadonlyMap<string, string>;

/**
 * Reads the L1 identifier of every node in `ids`. Content first, in one
 * batch; whatever that leaves unresolved is read as a person. An id that
 * resolves to neither fails the whole read: an act toward a node the
 * device cannot name is an act it cannot check.
 */
export async function fetchGraphIds(
  client: ApolloClient,
  ids: readonly string[],
): Promise<Outcome<GraphIds>> {
  const unique = [...new Set(ids)];
  const found = new Map<string, string>();
  if (unique.length === 0) return success(found);

  const content = await fetchOutcome(() =>
    client.query({
      query: ContentGraphIdsDocument,
      variables: { ids: unique },
      fetchPolicy: "network-only",
    }),
  );
  if (content.kind !== "success") return content;
  for (const node of content.value.nodes) {
    if (node !== null && (node.__typename === "Post" || node.__typename === "Comment")) {
      found.set(node.id, node.graphId);
    }
  }

  for (const id of unique) {
    if (found.has(id)) continue;
    const person = await fetchOutcome(() =>
      client.query({ query: UserGraphIdDocument, variables: { id }, fetchPolicy: "network-only" }),
    );
    if (person.kind !== "success") return person;
    const graphId = person.value.user?.graphId ?? null;
    if (graphId === null) return failed(new Error(`no graph identifier for node ${id}`));
    found.set(id, graphId);
  }
  return success(found);
}

/** The id's L1 identifier; throws when the read did not ask for it. */
export function graphIdOf(graphIds: GraphIds, id: string): string {
  const graphId = graphIds.get(id);
  if (graphId === undefined) throw new Error(`graph identifier for ${id} was never read`);
  return graphId;
}
