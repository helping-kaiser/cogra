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

import { HeldTopicsDocument } from "@/__generated__/graphql";
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
