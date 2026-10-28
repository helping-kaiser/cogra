// The topic surface (topics.graphql; hashtag.md): the topic page's own
// read, and the tag/un-tag gesture (D6) the edit screen stages. A stance
// toward a topic rides the ordinary stance seam (`@/lib/stance`), which
// this module does not repeat — no surface offers that gesture before
// slice 3.

import type { ApolloClient } from "@apollo/client";

import {
  HashtagDetailDocument,
  PrepareTagDocument,
  TagNamesDocument,
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

/** How many names in use the tag picker lists under its first row. */
export const TAG_NAME_LIMIT = 8;

/**
 * The names in use that start with `canonical` — the tag picker's index rows
 * (TagPicker.jsx), served by the search matcher's topic cue, the exact name
 * leading. `canonical` is the picker's already-canonical typed name, so the
 * cue is spelled here and nowhere else. A name that is not there is not an
 * error: it is simply unused (hashtag.md §2), and the first row still offers
 * it.
 */
export async function fetchTagNames(
  client: ApolloClient,
  canonical: string,
  limit: number = TAG_NAME_LIMIT,
): Promise<Outcome<readonly string[]>> {
  if (canonical === "") return success([]);
  const fetched = await fetchOutcome(() =>
    client.query({
      query: TagNamesDocument,
      variables: { query: `#${canonical}`, first: limit },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const names: string[] = [];
  for (const edge of fetched.value.search.edges) {
    // A redacted name reads null: there is nothing to offer under it.
    if (edge.node.__typename === "Hashtag" && edge.node.name.value) names.push(edge.node.name.value);
  }
  return success(names);
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
    /** Relevance `r`, as the UI shows it. Required; the un-tag sends `(0,0)`. */
    relevance: number;
    /** Confidence `c`, as the UI shows it. Required. */
    confidence: number;
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
            pDirected: fields.relevance,
            pInterest: fields.confidence,
          },
        },
      }),
    (data) => data.prepareTag.userErrors,
    (data) => data.prepareTag.writes?.map(stagedFromPrepared) ?? null,
  );
}
