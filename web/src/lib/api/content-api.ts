// The content surface (api-spec.md "Content authoring"; roadmap
// "Slice 2"): prepare verbs stage device-signed writes; reads serve the
// display store and need no session. An edit's field set is the full
// form state — a null title/description is the explicit clear; the
// wire's absent-means-untouched channel goes unused by this client.

import type { ApolloClient } from "@apollo/client";

import {
  CommentRepliesDocument,
  CommentSelfMarkDocument,
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
import type { ReferenceDraft } from "@/lib/references/draft";
import type { TagDraft } from "@/lib/topics/draft";
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

/**
 * The detail read's own post.
 *
 * NOT `PostView`, which is the FEED query's node: the two queries select
 * different things, and typing the detail's post as the list's hid every field
 * only the detail asks for — `sensitiveSelfMark` among them, which the edit
 * switch needs. The list shape stays assignable to every component that takes a
 * `PostView`, so naming the detail's shape honestly costs those nothing.
 */
export type PostDetailView = NonNullable<PostDetailQuery["post"]>;

export type PostDetail = {
  post: PostDetailView;
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

/**
 * The wire form of a drafted reference (`ReferenceInput`). The composer's
 * references are explicit structured input, never parsed from the body
 * (D15) — the same rule tags follow, and for the same reason: display
 * content and graph structure stay decoupled.
 */
function referenceInputs(references: readonly ReferenceDraft[] | undefined) {
  return (
    references?.map((reference) => ({
      target: reference.targetId,
      relevance: reference.relevance,
      support: reference.support,
    })) ?? null
  );
}

/**
 * One placement being authored: the asset, and what it is a picture of.
 *
 * The description travels here rather than with the upload because it is a
 * fact about this placement — the same asset can read differently in two
 * posts, and correcting a description is a new version of the post rather
 * than a re-upload. That is what lets the composer upload at pick time.
 */
export type GalleryEntryDraft = {
  mediaId: string;
  /** Empty is not a description; an undescribed picture sends null. */
  altText: string | null;
};

/**
 * The gallery, as the contract wants it: the list IS the order, so
 * `displayOrder` states each entry's own index and `isCover` is true on the
 * first and nowhere else. A value that disagrees with its position is refused
 * rather than quietly overridden, so both are derived here and never passed in.
 */
export function attachmentInputs(entries: readonly GalleryEntryDraft[] | undefined) {
  if (entries === undefined || entries.length === 0) return null;
  return entries.map((entry, index) => ({
    mediaId: entry.mediaId,
    displayOrder: index,
    isCover: index === 0,
    altText: entry.altText === null || entry.altText.trim() === "" ? null : entry.altText.trim(),
  }));
}

/**
 * The author's own sensitive mark, as the contract wants it.
 *
 * A REASON WITHOUT THE MARK IS A REFUSAL on `["sensitiveReason"]`, so the reason
 * only ever travels WITH `sensitive: true`; a blank one counts as none and is
 * sent as null rather than as an empty string.
 *
 * The switch's value is always stated rather than omitted, because an EDIT is
 * complete state: omitting `sensitive` on an edit would UNMARK a post the author
 * had marked, silently, which is the one direction this must never fail in.
 */
export function sensitiveInput(sensitive: boolean | undefined, reason: string | undefined) {
  const marked = sensitive === true;
  const trimmed = (reason ?? "").trim();
  return {
    sensitive: marked,
    sensitiveReason: marked && trimmed !== "" ? trimmed : null,
  };
}

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

/**
 * The author's own sensitive mark on one comment — what its edit switch shows.
 *
 * Its own read rather than a field on the detail query: see the operation's own
 * note. Null means the comment is gone; the caller keeps the switch where it
 * was rather than guessing at false, because guessing false would offer to
 * unveil something the author had veiled.
 */
export async function fetchCommentSelfMark(
  client: ApolloClient,
  id: string,
): Promise<Outcome<boolean | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: CommentSelfMarkDocument,
      variables: { id },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  return success(fetched.value.comment?.sensitiveSelfMark ?? null);
}

function liftPrepared(payload: {
  node?: string | null;
  writes?: readonly Parameters<typeof stagedFromPrepared>[0][] | null;
}): PreparedContent | null {
  if (!payload.node || !payload.writes) return null;
  return { node: payload.node, writes: payload.writes.map(stagedFromPrepared) };
}

export async function preparePost(
  client: ApolloClient,
  fields: {
    title: string | null;
    description: string | null;
    /** Null on a media post: the body is words XOR media (D16). */
    content: string | null;
    license: LicenseChoice;
    tags?: readonly TagDraft[];
    references?: readonly ReferenceDraft[];
    /** Assets already uploaded, in gallery order, each with its description. */
    attachments?: readonly GalleryEntryDraft[];
    /** The author's own sensitive mark. Omitted counts as false. */
    sensitive?: boolean;
    sensitiveReason?: string;
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
            attachments: attachmentInputs(fields.attachments),
            ...sensitiveInput(fields.sensitive, fields.sensitiveReason),
            // The composer's tags are explicit structured input, never
            // parsed from the body (api-spec.md `preparePost`); each
            // carries the pair its sliders hold (F6).
            tags:
              fields.tags?.map((tag) => ({
                name: tag.name,
                pDirected: tag.relevance,
                pInterest: tag.confidence,
              })) ?? null,
            references: referenceInputs(fields.references),
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
    /**
     * REQUIRED, and deliberately not optional: an edit is COMPLETE STATE, so
     * omitting the mark unmarks a post the author had marked. Making the caller
     * state it is what stops that happening by forgetting.
     */
    sensitive: boolean;
    sensitiveReason?: string;
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
            ...sensitiveInput(fields.sensitive, fields.sensitiveReason),
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
    tags?: readonly TagDraft[];
    references?: readonly ReferenceDraft[];
    /** The pictures, in the author's order, each with its description. */
    attachments?: readonly GalleryEntryDraft[];
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
            // A comment is words PLUS optional pictures — the words-or-media
            // XOR is the post's rule alone (D16), so both travel together.
            attachments: attachmentInputs(fields.attachments),
            // Tagging is part of the compose gesture on a comment as on
            // a post (api-spec.md `PrepareCommentInput.tags`, "same rules
            // as on a Post") — one batch on the minting record.
            tags:
              fields.tags?.map((tag) => ({
                name: tag.name,
                pDirected: tag.relevance,
                pInterest: tag.confidence,
              })) ?? null,
            // Referencing is part of the same gesture, under its own
            // ten-per-batch cap (D7).
            references: referenceInputs(fields.references),
          },
        },
      }),
    (data) => data.prepareComment.userErrors,
    (data) => liftPrepared(data.prepareComment),
  );
}

export async function prepareCommentEdit(
  client: ApolloClient,
  // `sensitive` is required for the same reason it is on a post edit: an edit
  // is complete state, so an omitted mark unveils a comment its author veiled.
  fields: { id: string; content: string; sensitive: boolean; sensitiveReason?: string },
): Promise<Outcome<PreparedContent>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: PrepareCommentEditDocument,
        variables: {
          input: {
            id: fields.id,
            content: fields.content,
            ...sensitiveInput(fields.sensitive, fields.sensitiveReason),
          },
        },
      }),
    (data) => data.prepareCommentEdit.userErrors,
    (data) => liftPrepared(data.prepareCommentEdit),
  );
}
