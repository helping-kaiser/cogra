// The topics the feed filter's One topic section offers (FeedSheet.md:29-35;
// FeedTopic.md: "only a topic the reader holds an opinion for, with a netted
// Affinity that is not (0, 0) and associates positively, can be on"): the
// reader's held topics (api-spec.md `User.heldTopics`) whose association —
// the folded `pDirected` — is positive. A topic held against stays a record,
// listed on Your topics; it never narrows a feed.
//
// The list comes strongest first by association, so the held-for topics lead
// it: the read pages on only while the last edge it holds is still held for,
// and stops at the first that is not.

import type { ApolloClient } from "@apollo/client";

import { HeldTopicsCountDocument, HeldTopicsDocument } from "@/__generated__/graphql";
import type { FeedTopic } from "@/lib/feed/feed-filter";
import { success, viewerField, type Outcome } from "./outcome";

/** Pages read at most — 50 a page, so 200 topics held for. */
const MAX_PAGES = 4;

export async function fetchHeldTopicsFor(client: ApolloClient): Promise<Outcome<readonly FeedTopic[]>> {
  const topics: FeedTopic[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const read = await viewerField(
      () =>
        client.query({
          query: HeldTopicsDocument,
          variables: { after },
          fetchPolicy: "network-only",
        }),
      (data) => data.me?.heldTopics ?? null,
    );
    if (read.kind !== "success") return read;
    let last = 0;
    for (const edge of read.value.edges) {
      last = edge.pDirected;
      const name = edge.node.name.value;
      if (edge.pDirected > 0 && name !== null && name !== undefined && edge.node.name.status !== "REDACTED") {
        topics.push({ id: edge.node.id, name });
      }
    }
    if (!read.value.pageInfo.hasNextPage || last <= 0) break;
    after = read.value.pageInfo.endCursor ?? null;
    if (after === null) break;
  }
  return success(topics);
}

/** One row of Your topics: the topic, the pair the reader signed, and whether an act is in flight. */
export type HeldTopic = {
  readonly id: string;
  /** The topic's name; null when moderation redacted it. */
  readonly name: string | null;
  readonly pDirected: number;
  readonly pInterest: number;
  readonly pending: boolean;
};

export type HeldTopicsPage = {
  readonly items: readonly HeldTopic[];
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

/**
 * One page of Your topics (YourTopics.md; api-spec.md `User.heldTopics`):
 * every held topic — the ones held against included — strongest first by
 * association, as served. Pending acts ride in (`includePending`), so a topic
 * taken up a moment ago stands with its settling mark.
 */
export async function fetchHeldTopicsPage(
  client: ApolloClient,
  after: string | null,
): Promise<Outcome<HeldTopicsPage>> {
  const read = await viewerField(
    () =>
      client.query({
        query: HeldTopicsDocument,
        variables: { after, includePending: true },
        fetchPolicy: "network-only",
      }),
    (data) => data.me?.heldTopics ?? null,
  );
  if (read.kind !== "success") return read;
  return success({
    items: read.value.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name.status === "REDACTED" ? null : (edge.node.name.value ?? null),
      pDirected: edge.pDirected,
      pInterest: edge.pInterest,
      pending: edge.pending,
    })),
    endCursor: read.value.pageInfo.endCursor ?? null,
    hasNextPage: read.value.pageInfo.hasNextPage,
  });
}

/**
 * Explore's door's count (Explore.md:41): the length of the list the door
 * opens — the same read, pending included, asked for its total alone.
 */
export async function fetchHeldTopicsCount(client: ApolloClient): Promise<Outcome<number>> {
  const read = await viewerField(
    () =>
      client.query({
        query: HeldTopicsCountDocument,
        variables: { includePending: true },
        fetchPolicy: "network-only",
      }),
    (data) => data.me?.heldTopics ?? null,
  );
  if (read.kind !== "success") return read;
  // A count the server cannot state is not one a line can print.
  return success(read.value.totalCount ?? 0);
}
