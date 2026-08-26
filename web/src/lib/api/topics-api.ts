// The topic surface (topics.graphql; hashtag.md): the topic page's own
// read, and the standalone tag/un-tag gesture (D6). The follow
// control's read/write rides `viewerStance` on `Hashtag` through the
// ordinary stance seam (`@/lib/stance`) — this module does not repeat
// it.

import type { ApolloClient } from "@apollo/client";

import {
  HashtagDetailDocument,
  PrepareTagDocument,
  type HashtagDetailQuery,
} from "@/__generated__/graphql";
import { fetchOutcome, payloadOutcome, success, type Outcome } from "./outcome";
import { stagedFromPrepared, type StagedWriteView } from "./writes-api";

export type HashtagDetail = NonNullable<HashtagDetailQuery["hashtag"]>;
export type TaggedContentItem = HashtagDetail["taggedContent"][number];

/**
 * `hashtag(name:)` resolves any well-formed name (D4): a Type is
 * anchored vacuously, so a topic nobody has tagged yet still renders —
 * null answers only a substrate-illegal name.
 */
export async function fetchHashtagDetail(
  client: ApolloClient,
  name: string,
): Promise<Outcome<HashtagDetail | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: HashtagDetailDocument,
      variables: { name },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  return success(fetched.value.hashtag ?? null);
}

/**
 * The standalone Tag gesture (D6, post.md §3): adds a topic to existing
 * content, or — at `relevance: 0` — withdraws it (hashtag.md §4). Never
 * rides the post/comment edit form (D14): each is its own priced act
 * with its own signing handshake.
 */
export async function prepareTag(
  client: ApolloClient,
  fields: {
    target: string;
    name: string;
    /** Relevance `r`; omit for the server default `+0.1`. `0` un-tags. */
    relevance?: number;
    /** Confidence `c`; omit for the server default `1`. */
    confidence?: number;
  },
): Promise<Outcome<readonly StagedWriteView[]>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: PrepareTagDocument,
        variables: {
          input: {
            target: fields.target,
            name: fields.name,
            pDirected: fields.relevance ?? null,
            pInterest: fields.confidence ?? null,
          },
        },
      }),
    (data) => data.prepareTag.userErrors,
    (data) => data.prepareTag.writes?.map(stagedFromPrepared) ?? null,
  );
}
