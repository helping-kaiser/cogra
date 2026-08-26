// The content surface (api-spec.md "Content authoring"; roadmap
// "Slice 2"): prepare verbs stage device-signed writes; reads serve the
// display store and need no session. An edit's field set is the full
// form state — a null title/description is the explicit clear; the
// wire's absent-means-untouched channel goes unused by this client.

import type { ApolloClient } from "@apollo/client";

import {
  CommentRepliesDocument,
  PostDetailDocument,
  PostsDocument,
  PrepareCommentDocument,
  PrepareCommentEditDocument,
  PreparePostDocument,
  PreparePostEditDocument,
  type LandingState,
  type PostDetailQuery,
  type PostsQuery,
} from "@/__generated__/graphql";
import type { License } from "@/lib/license";
import { failed, fetchOutcome, payloadOutcome, success, type Outcome } from "./outcome";
import { stagedFromPrepared, type StagedWriteView } from "./writes-api";

export type PostView = PostsQuery["posts"]["edges"][number]["node"];

type DetailPost = NonNullable<PostDetailQuery["post"]>;
export type CommentView = DetailPost["comments"]["edges"][number]["node"];
/** A nested reply — one prefetched level under each comment. */
export type ReplyView = CommentView["replies"]["edges"][number]["node"];

export type Page<T> = {
  items: readonly T[];
  endCursor: string | null;
  hasNextPage: boolean;
};

/**
 * Whether a content node is authored but not yet ordered on L1
 * (api-spec.md "Landing"). An unlanded edit reads PENDING too — the
 * text on screen is the pending version.
 */
export function isPending(node: { landing: { state: LandingState } }): boolean {
  return node.landing.state === "PENDING";
}

export type PostDetail = {
  post: PostView;
  comments: Page<CommentView>;
};

/** The declaration a genesis content write carries (`@/lib/license`). */
export type LicenseChoice = License;

/**
 * A prepared content write: the node id the content will serve under
 * once landed, plus the staged writes for this device to sign.
 */
export type PreparedContent = {
  node: string;
  writes: readonly StagedWriteView[];
};

/** One page per fetch; the server default is the same number. */
export const CONTENT_PAGE_SIZE = 20;

/** The reply prefetch depth of every thread read — one level. */
export const REPLIES_FIRST = 3;

/**
 * The landed-only opt-out (api-spec.md "Pagination"). Reads serve
 * pending entries by default — they are their author's content already;
 * `includePending: false` serves only what has landed on L1, for a
 * reader who wants the settled graph.
 */
export type ListingOptions = { includePending?: boolean };

const INCLUDE_PENDING_DEFAULT = true;

function includePendingOf(options: ListingOptions): boolean {
  return options.includePending ?? INCLUDE_PENDING_DEFAULT;
}

/** A further page of one comment's direct replies (expand). */
export async function fetchCommentReplies(
  client: ApolloClient,
  commentId: string,
  after: string | null = null,
  options: ListingOptions = {},
): Promise<Outcome<Page<CommentView>>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: CommentRepliesDocument,
      variables: {
        id: commentId,
        first: CONTENT_PAGE_SIZE,
        after,
        repliesFirst: REPLIES_FIRST,
        includePending: includePendingOf(options),
      },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const comment = fetched.value.comment;
  if (!comment) return failed(new Error("comment vanished under its replies"));
  return success({
    items: comment.replies.edges.map((edge) => edge.node),
    endCursor: comment.replies.pageInfo.endCursor ?? null,
    hasNextPage: comment.replies.pageInfo.hasNextPage,
  });
}

export async function fetchPosts(
  client: ApolloClient,
  after: string | null = null,
  options: ListingOptions = {},
): Promise<Outcome<Page<PostView>>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: PostsDocument,
      variables: {
        first: CONTENT_PAGE_SIZE,
        after,
        includePending: includePendingOf(options),
      },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const posts = fetched.value.posts;
  return success({
    items: posts.edges.map((edge) => edge.node),
    endCursor: posts.pageInfo.endCursor ?? null,
    hasNextPage: posts.pageInfo.hasNextPage,
  });
}

/** null: the id names no post. */
export async function fetchPostDetail(
  client: ApolloClient,
  id: string,
  commentsAfter: string | null = null,
  options: ListingOptions = {},
): Promise<Outcome<PostDetail | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: PostDetailDocument,
      variables: {
        id,
        commentsFirst: CONTENT_PAGE_SIZE,
        commentsAfter,
        repliesFirst: REPLIES_FIRST,
        includePending: includePendingOf(options),
      },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const post = fetched.value.post;
  if (!post) return success(null);
  return success({
    post,
    comments: {
      items: post.comments.edges.map((edge) => edge.node),
      endCursor: post.comments.pageInfo.endCursor ?? null,
      hasNextPage: post.comments.pageInfo.hasNextPage,
    },
  });
}

function liftPrepared(payload: {
  node?: string | null;
  writes?: readonly Parameters<typeof stagedFromPrepared>[0][] | null;
}): PreparedContent | null {
  if (!payload.node || !payload.writes) return null;
  return { node: payload.node, writes: payload.writes.map(stagedFromPrepared) };
}

/**
 * The composer sends only names (api-spec.md `preparePost` docstring:
 * "Tags are explicit structured inputs, never parsed from the body") —
 * relevance and confidence default server-side per D13. Never carried on
 * an edit: new tags are their own gesture, not an edit field (D14).
 */
export type TagDraft = { readonly name: string };

export async function preparePost(
  client: ApolloClient,
  fields: {
    title: string | null;
    description: string | null;
    content: string;
    license: LicenseChoice;
    tags?: readonly TagDraft[];
  },
): Promise<Outcome<PreparedContent>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: PreparePostDocument,
        variables: {
          input: {
            title: fields.title,
            description: fields.description,
            content: fields.content,
            license: fields.license,
            tags: fields.tags?.map((tag) => ({ name: tag.name })) ?? null,
          },
        },
      }),
    (data) => data.preparePost.userErrors,
    (data) => liftPrepared(data.preparePost),
  );
}

export async function preparePostEdit(
  client: ApolloClient,
  fields: {
    id: string;
    title: string | null;
    description: string | null;
    content: string;
  },
): Promise<Outcome<PreparedContent>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: PreparePostEditDocument,
        variables: {
          input: {
            id: fields.id,
            title: fields.title,
            description: fields.description,
            content: fields.content,
          },
        },
      }),
    (data) => data.preparePostEdit.userErrors,
    (data) => liftPrepared(data.preparePostEdit),
  );
}

export async function prepareComment(
  client: ApolloClient,
  fields: {
    target: string;
    content: string;
    license: LicenseChoice;
  },
): Promise<Outcome<PreparedContent>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: PrepareCommentDocument,
        variables: {
          input: {
            target: fields.target,
            content: fields.content,
            license: fields.license,
          },
        },
      }),
    (data) => data.prepareComment.userErrors,
    (data) => liftPrepared(data.prepareComment),
  );
}

export async function prepareCommentEdit(
  client: ApolloClient,
  fields: { id: string; content: string },
): Promise<Outcome<PreparedContent>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: PrepareCommentEditDocument,
        variables: { input: { id: fields.id, content: fields.content } },
      }),
    (data) => data.prepareCommentEdit.userErrors,
    (data) => liftPrepared(data.prepareCommentEdit),
  );
}
