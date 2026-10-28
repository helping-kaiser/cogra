// The score's trace reads (api-spec.md `feedTrace`, `nodes`; score-readout
// packet §7), lifted into outcomes. Both are public reads — guests open
// traces (Main.md:67) — so nothing here asks for a session.
//
// THE TRACE IS LIVE, NEVER CACHED: every open is a real fetch (PR-39), so the
// read goes `network-only` and the answer is held by the trace that asked,
// never by Apollo's cache, where a second open could be served a stale one.

import type { ApolloClient } from "@apollo/client";

import { FeedTraceDocument, TraceNodesDocument, type TraceNodesQuery } from "@/__generated__/graphql";
import { commentCover, personCover, postCover, type TraceCover } from "@/lib/score/cover";
import type { Named, TraceAnswer } from "@/lib/score/trace-model";
import { fetchOutcome, success, type Outcome } from "./outcome";

/**
 * `target`'s standing in `viewer`'s view, as this read finds it. Null when
 * the viewer resolves to no rankable actor.
 */
export async function fetchFeedTrace(
  client: ApolloClient,
  viewer: string,
  target: string,
): Promise<Outcome<TraceAnswer | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({ query: FeedTraceDocument, variables: { viewer, target }, fetchPolicy: "network-only" }),
  );
  if (fetched.kind !== "success") return fetched;
  const trace = fetched.value.feedTrace;
  if (!trace) return success(null);
  return success({
    score: trace.score ?? null,
    paths: trace.paths.map((path) => ({
      nodes: path.nodes.map((node) => ({ graphId: node.graphId, id: node.id ?? null, kind: node.kind ?? null })),
      sign: path.sign,
      contribution: path.contribution,
      hops: path.hops.map((hop) => ({
        pDirected: hop.pDirected,
        pInterest: hop.pInterest,
        records: hop.records.map((record) => ({
          id: record.id,
          family: record.family,
          author: record.author
            ? {
                id: record.author.id,
                handle: record.author.handle,
                displayName: record.author.displayName.value ?? null,
              }
            : null,
          landedAt: record.landedAt,
          legs: record.legs.map((leg) => ({
            role: leg.role,
            sourceId: leg.sourceId,
            targetId: leg.targetId,
            pDirected: leg.pDirected,
            pInterest: leg.pInterest,
            censusUnknown: leg.censusUnknown,
          })),
        })),
      })),
    })),
  });
}

type TraceNodeRow = NonNullable<TraceNodesQuery["nodes"][number]>;

/** The hydrated rows a trace names, and the covers they make. */
export type TraceNodes = {
  readonly named: ReadonlyMap<string, Named>;
  readonly covers: ReadonlyMap<string, TraceCover>;
};

function namedOf(row: TraceNodeRow): [string, Named, TraceCover] | null {
  switch (row.__typename) {
    case "User":
      return [
        row.id,
        {
          kind: "person",
          person: {
            id: row.id,
            handle: row.handle,
            displayName: row.displayName.value ?? null,
            avatarUrl: row.avatar?.url ?? null,
          },
        },
        personCover(row),
      ];
    case "Post":
      return [
        row.id,
        {
          kind: "post",
          id: row.id,
          title: row.title.value ?? null,
          authorHandle: row.author?.handle ?? null,
          createdAt: row.createdAt,
        },
        postCover(row),
      ];
    case "Comment":
      return [
        row.id,
        { kind: "comment", id: row.id, authorHandle: row.author?.handle ?? null, createdAt: row.createdAt },
        commentCover(row),
      ];
    default:
      return null;
  }
}

/** One batch over the answer's distinct row ids (score-readout §7). */
export async function fetchTraceNodes(
  client: ApolloClient,
  ids: readonly string[],
): Promise<Outcome<TraceNodes>> {
  if (ids.length === 0) return success({ named: new Map(), covers: new Map() });
  const fetched = await fetchOutcome(() =>
    client.query({ query: TraceNodesDocument, variables: { ids: [...ids] }, fetchPolicy: "network-only" }),
  );
  if (fetched.kind !== "success") return fetched;
  const named = new Map<string, Named>();
  const covers = new Map<string, TraceCover>();
  for (const row of fetched.value.nodes) {
    const read = row === null ? null : namedOf(row);
    if (read === null) continue;
    named.set(read[0], read[1]);
    covers.set(read[0], read[2]);
  }
  return success({ named, covers });
}
