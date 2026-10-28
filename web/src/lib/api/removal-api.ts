// The author's Remove (api-spec.md `removeContent`; erasure.md §1), lifted
// into an outcome, and the node re-read that brings its mark back.
//
// IMMEDIATE AND UNSIGNED. Removal is pure L2 policy — nothing is prepared or
// signed — so it is one authenticated request, not a prepare-and-sign
// handshake. The client always names the node's GENESIS record with
// `includeRevisions: true`: the confirm promises "every earlier version's",
// and removing "the post" is the whole chain (erasure.md §1).

import type { ApolloClient } from "@apollo/client";

import {
  CommentRemovalDocument,
  PostRemovalDocument,
  RemoveContentDocument,
  type RemovalAgent,
} from "@/__generated__/graphql";
import { readCachedPost, type PostView } from "./content-api";
import { fetchOutcome, payloadOutcome, success, type Outcome } from "./outcome";

/** A node's mark, as `Post.removal` / `Comment.removal` serve it. */
export type Removal = {
  readonly __typename?: "Removal";
  readonly at: string;
  readonly by: RemovalAgent;
};

/**
 * Removes the chain a genesis record names. Succeeds with the moment the
 * server stamped on the first landed record, or null — a still-settling node
 * answers `records: []` with no error, and lands reduced (api-spec.md).
 */
export function removeContent(
  client: ApolloClient,
  record: string,
): Promise<Outcome<string | null>> {
  return payloadOutcome(
    () => client.mutate({ mutation: RemoveContentDocument, variables: { record } }),
    (data) => data.removeContent.userErrors,
    // Wrapped so an empty list is a success, not the contract break a null
    // value would read as (`payload`).
    (data) => ({ at: data.removeContent.records.find((r) => r.redactedAt)?.redactedAt ?? null }),
  ).then((outcome) => (outcome.kind === "success" ? success(outcome.value.at) : outcome));
}

/**
 * The node's own mark, read fresh after a removal (RM-G5). Null when the node
 * answers none — which a taken removal never leaves, and the caller then
 * stamps the mark from the removal's own answer.
 */
export async function fetchRemoval(
  client: ApolloClient,
  kind: "post" | "comment",
  id: string,
): Promise<Outcome<Removal | null>> {
  if (kind === "post") {
    const fetched = await fetchOutcome(() =>
      client.query({ query: PostRemovalDocument, variables: { id }, fetchPolicy: "network-only" }),
    );
    return fetched.kind === "success" ? success(fetched.value.post?.removal ?? null) : fetched;
  }
  const fetched = await fetchOutcome(() =>
    client.query({ query: CommentRemovalDocument, variables: { id }, fetchPolicy: "network-only" }),
  );
  return fetched.kind === "success" ? success(fetched.value.comment?.removal ?? null) : fetched;
}

/**
 * The mark a taken removal leaves, for every surface that holds the node.
 *
 * The re-read is the truth; when it cannot be had, the removal's own answer
 * stamps the mark — the server's `redactedAt` where a record had landed, this
 * moment where none had. Either way the node never stands unmarked after a
 * taken removal (RemoveConfirm.md:11, "NEVER the post leaves without a mark").
 */
export async function markAfterRemoval(
  client: ApolloClient,
  kind: "post" | "comment",
  id: string,
  stamped: string | null,
  now: () => string = () => new Date().toISOString(),
): Promise<Removal> {
  const read = await fetchRemoval(client, kind, id);
  if (read.kind === "success" && read.value !== null) return read.value;
  const mark: Removal = { __typename: "Removal", at: stamped ?? now(), by: "AUTHOR" };
  // The re-read normalises its answer onto the cached node by itself; a
  // stamped mark has to be written there by hand, or a cached read — the
  // detail's first paint, a remembered feed — would show the node whole.
  client.cache.modify({
    id: client.cache.identify({ __typename: kind === "post" ? "Post" : "Comment", id }),
    fields: { removal: () => mark },
  });
  return mark;
}

/**
 * The node in hand, wearing its mark — what a surface swaps in for the card it
 * holds, so the card stands as its mark in place.
 */
export function withRemoval<N extends { readonly removal?: Removal | null }>(node: N, removal: Removal): N {
  return { ...node, removal: { __typename: "Removal", at: removal.at, by: removal.by } };
}

/**
 * A post held from before, wearing the mark the cache has learned since.
 *
 * A surface that comes back from memory (the feed's pages) holds the post as
 * it was when it left — and a removal taken on the detail in between reached
 * the cache, not that memory. Only the mark is taken over: everything else
 * the memory holds stays what the reader left.
 */
export function withCachedRemoval(client: ApolloClient, post: PostView): PostView {
  if (post.removal) return post;
  const removal = readCachedPost(client, post.id)?.removal;
  return removal ? withRemoval(post, removal) : post;
}
