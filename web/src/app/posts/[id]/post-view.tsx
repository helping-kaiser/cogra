"use client";

// One post and its direct thread (comment.md §2), with the comment box —
// a genesis Review signed in this browser. A signed comment is already
// its author's content (substrate.md §6), so the thread re-reads and the
// author finds it in place under the pending marker — only L1 finality
// is still outstanding. Slice 2.1 closes the thread's UI gaps:
// author chips, the creator's inline edit with the soft Edited marker
// (design.md §9), inline replies, and the nested reply tree — one
// prefetched level, more on demand.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { PUBLIC_DOMAIN, type License } from "@/lib/license";
import {
  fetchCommentReplies,
  fetchPostDetail,
  isPending,
  prepareComment,
  prepareCommentEdit,
  type CommentView,
  type PostDetail,
  type ReplyView,
} from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { ActorChip } from "@/lib/ui/actor-chip";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { LicenseChooser, LicenseTerms } from "@/lib/ui/license-fields";
import { PageHeader } from "@/lib/ui/page-header";
import { PendingMarker } from "@/lib/ui/pending-marker";
import { SigningPending } from "@/lib/ui/signing-pending";
import { StanceControl } from "@/lib/ui/stance-control";
import { TopicChipRow, type TopicChipEntry } from "@/lib/ui/topic-chip-row";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

/** `TopicClaim[]` off any content node, projected down to the chip row's shape. */
function chipEntries(topics: readonly { hashtag: { name: { value?: string | null } }; pending: boolean }[]): readonly TopicChipEntry[] {
  return topics.map((claim) => ({ name: claim.hashtag.name.value ?? "", pending: claim.pending }));
}

/** Any node of the thread tree — a comment or a nested reply. */
type ThreadComment = CommentView | ReplyView;

/** One comment's reply thread as expanded past the prefetched page. */
type ReplyThread = {
  items: readonly ThreadComment[];
  endCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
};

/** Nesting indents up to three levels, then flattens (design.md §6). */
const MAX_INDENT_DEPTH = 3;

function prefetchedReplies(comment: ThreadComment): {
  items: readonly ThreadComment[];
  endCursor: string | null;
  hasMore: boolean;
} {
  if (!("replies" in comment)) return { items: [], endCursor: null, hasMore: false };
  return {
    items: comment.replies.edges.map((edge) => edge.node),
    endCursor: comment.replies.pageInfo.endCursor ?? null,
    hasMore: comment.replies.pageInfo.hasNextPage,
  };
}

export function PostView({
  postId,
  store = identityStore,
}: {
  postId: string;
  /** Test injection. */
  store?: IdentityStore;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const viewerId = useActiveAccountId();
  const phase = useAuthPhase();

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<readonly CommentView[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [transportFault, setTransportFault] = useState<TransportFault | null>(null);

  const [draft, setDraft] = useState("");
  const [license, setLicense] = useState<License>(PUBLIC_DOMAIN);
  const [submitting, setSubmitting] = useState(false);
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);
  const [signIncomplete, setSignIncomplete] = useState(false);
  const [signingNeedsKey, setSigningNeedsKey] = useState(false);
  // A submit that never reached the server; a composer error, not a read fault.
  const [submitFailed, setSubmitFailed] = useState(false);
  const [commentSigned, setCommentSigned] = useState(false);

  // Reply threads expanded past their prefetched page, keyed by comment.
  const [replyThreads, setReplyThreads] = useState<Record<string, ReplyThread>>({});
  // The inline comment edit — the affordance renders on own comments only.
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFailed, setEditFailed] = useState(false);
  // The inline reply — a genesis Review targeting the comment.
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyFailed, setReplyFailed] = useState(false);

  const refresh = useCallback(() => {
    let cancelled = false;
    void fetchPostDetail(client, postId).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        setTransportFault("refresh");
      } else if (outcome.value === null) {
        setTransportFault(null);
        setNotFound(true);
      } else {
        setTransportFault(null);
        setDetail(outcome.value);
        setComments(outcome.value.comments.items);
        setEndCursor(outcome.value.comments.endCursor);
        setHasMore(outcome.value.comments.hasNextPage);
        // The prefetch re-read everything; expansions start over.
        setReplyThreads({});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, postId]);

  useEffect(() => refresh(), [refresh]);

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const outcome = await fetchPostDetail(client, postId, endCursor);
    setLoadingMore(false);
    if (outcome.kind !== "success") {
      setTransportFault("append");
      return;
    }
    if (outcome.value === null) return;
    setTransportFault(null);
    const next = outcome.value.comments;
    setComments((current) => appendDeduped(current, next.items));
    setEndCursor(next.endCursor);
    setHasMore(next.hasNextPage);
  };

  const onLoadMoreReplies = async (comment: ThreadComment) => {
    const seeded = replyThreads[comment.id] ?? {
      ...prefetchedReplies(comment),
      loading: false,
      failed: false,
    };
    if (seeded.loading) return;
    setReplyThreads((current) => ({
      ...current,
      [comment.id]: { ...seeded, loading: true, failed: false },
    }));
    const outcome = await fetchCommentReplies(client, comment.id, seeded.endCursor);
    setReplyThreads((current) => ({
      ...current,
      [comment.id]:
        outcome.kind === "success"
          ? {
              items: appendDeduped(seeded.items, outcome.value.items),
              endCursor: outcome.value.endCursor,
              hasMore: outcome.value.hasNextPage,
              loading: false,
              failed: false,
            }
          : { ...seeded, loading: false, failed: true },
    }));
  };

  const signAll = async (writes: readonly Parameters<typeof signer.signStaged>[0][]) => {
    const results = [];
    for (const staged of writes) {
      results.push(await signer.signStaged(staged));
    }
    return results.every((result) => result.kind === "done");
  };

  const onSubmitComment = async () => {
    if (submitting || draft.trim() === "") return;
    setSubmitting(true);
    setRefusedMessage(null);
    setSignIncomplete(false);
    setSubmitFailed(false);
    setCommentSigned(false);
    const prepared = await guard.run(() =>
      prepareComment(client, {
        target: postId,
        content: draft,
        license,
      }),
    );
    if (prepared.kind === "refused") {
      setSubmitting(false);
      setRefusedMessage(prepared.errors[0]?.message ?? "The server refused this write.");
      return;
    }
    if (prepared.kind === "failed") {
      setSubmitting(false);
      setSubmitFailed(true);
      return;
    }
    const done = await signAll(prepared.value.writes);
    setSubmitting(false);
    if (done) {
      setDraft("");
      setCommentSigned(true);
      // The comment is content from the moment it is signed, so re-read
      // the thread and show it rather than sending the author away to
      // refresh by hand. Refetching is the client's own explicit act
      // (api-spec.md "A page is a snapshot, not a live view") — this is
      // that act, not a merge into the page already held.
      refresh();
    } else {
      setSigningNeedsKey((await store.actorKey()) === null);
      setSignIncomplete(true);
    }
  };

  const onSubmitEdit = async () => {
    if (editing === null || editSubmitting || editing.draft.trim() === "") return;
    setEditSubmitting(true);
    setEditFailed(false);
    const prepared = await guard.run(() =>
      prepareCommentEdit(client, { id: editing.id, content: editing.draft }),
    );
    if (prepared.kind !== "success") {
      setEditSubmitting(false);
      setEditFailed(true);
      return;
    }
    const done = await signAll(prepared.value.writes);
    setEditSubmitting(false);
    if (done) {
      setEditing(null);
      setCommentSigned(true);
      refresh();
    } else {
      setEditFailed(true);
    }
  };

  const onSubmitReply = async () => {
    if (replyingTo === null || replySubmitting || replyDraft.trim() === "") return;
    setReplySubmitting(true);
    setReplyFailed(false);
    const prepared = await guard.run(() =>
      prepareComment(client, {
        target: replyingTo,
        content: replyDraft,
        license,
      }),
    );
    if (prepared.kind !== "success") {
      setReplySubmitting(false);
      setReplyFailed(true);
      return;
    }
    const done = await signAll(prepared.value.writes);
    setReplySubmitting(false);
    if (done) {
      setReplyingTo(null);
      setReplyDraft("");
      setCommentSigned(true);
      refresh();
    } else {
      setReplyFailed(true);
    }
  };

  // The header rides every branch — a dead end (not found, transport
  // fault) is exactly where the back arrow matters most.
  const header = (isCreator: boolean) => (
    <PageHeader
      backHref="/feed"
      backLabel="Back to feed"
      backTestId="post-back"
      action={
        isCreator ? (
          <Link
            href={`/compose?post=${postId}`}
            data-testid="post-edit"
            className={buttonClassName({ variant: "outline", size: "sm" })}
          >
            Edit
          </Link>
        ) : undefined
      }
    />
  );

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header(false)}
        <p>Loading…</p>
      </main>
    );
  }
  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header(false)}
        <p role="alert" data-testid="post-not-found">
          This post no longer resolves.
        </p>
      </main>
    );
  }
  if (detail === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header(false)}
        <div className="flex items-center gap-3">
          <TransportError testId="post-transport-error" />
          <Button
            testId="post-retry"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              refresh();
            }}
          >
            Retry
          </Button>
        </div>
      </main>
    );
  }

  const post = detail.post;

  const renderComment = (comment: ThreadComment, depth: number): React.ReactNode => {
    const thread = replyThreads[comment.id];
    const prefetch = prefetchedReplies(comment);
    const replies = thread?.items ?? prefetch.items;
    const repliesHaveMore = thread?.hasMore ?? prefetch.hasMore;
    const isOwn = viewerId !== null && comment.author?.id === viewerId;
    const isEditing = editing?.id === comment.id;
    const edited = comment.updatedAt > comment.createdAt;
    return (
      <li
        key={comment.id}
        data-testid={`post-comment-${comment.id}`}
        className="flex flex-col gap-3"
        style={{ marginLeft: `${Math.min(depth, MAX_INDENT_DEPTH) * 12}px` }}
      >
        <Card>
          {comment.author && (
            <ActorChip
              handle={comment.author.handle}
              displayName={comment.author.displayName.value}
              testId={`comment-author-${comment.id}`}
            />
          )}
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editing.draft}
                onChange={(event) => setEditing({ id: comment.id, draft: event.target.value })}
                rows={3}
                aria-label="Edit comment"
                data-testid="comment-edit-input"
                className="rounded-extra-small border border-outline p-2"
              />
              {editFailed && (
                <p role="alert" data-testid="comment-edit-failed" className="text-body-small text-error">
                  That didn&apos;t save. Try again.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  testId="comment-edit-save"
                  size="sm"
                  onClick={() => void onSubmitEdit()}
                  disabled={editSubmitting || editing.draft.trim() === ""}
                >
                  Save
                </Button>
                <Button
                  testId="comment-edit-cancel"
                  variant="text"
                  size="sm"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-body-medium">{comment.content.value}</p>
              <LicenseTerms
                license={comment.license}
                testId={`comment-license-terms-${comment.id}`}
              />
              {/* The soft marker, friendly not forensic (design.md §9). */}
              {edited && (
                <p
                  data-testid={`comment-edited-${comment.id}`}
                  className="text-label-small text-on-surface-variant"
                >
                  Edited
                </p>
              )}
              {/* Its sibling in the same register: an unlanded comment
                  — or one carrying an unlanded edit — is still real. */}
              {isPending(comment) && (
                <PendingMarker testId={`comment-pending-${comment.id}`} />
              )}
              {/* Read-only everywhere on a card or a detail view (F3):
                  the plain, tappable chip row (design.md §6). */}
              <TopicChipRow
                topics={chipEntries(comment.topics)}
                testIdPrefix={`comment-${comment.id}`}
              />
              {/* The comment carries its own stance control (design.md §6). */}
              <StanceControl
                target={{ id: comment.id, kind: "comment", label: "this comment" }}
                testIdPrefix={`comment-stance-${comment.id}`}
              />
              <div className="flex gap-2">
                {phase === "signedIn" && (
                  <Button
                    testId={`comment-reply-${comment.id}`}
                    variant="text"
                    size="sm"
                    onClick={() => {
                      setReplyingTo(comment.id);
                      setReplyDraft("");
                      setEditing(null);
                    }}
                  >
                    Reply
                  </Button>
                )}
                {isOwn && (
                  <Button
                    testId={`comment-edit-${comment.id}`}
                    variant="text"
                    size="sm"
                    onClick={() => {
                      setEditing({ id: comment.id, draft: comment.content.value ?? "" });
                      setReplyingTo(null);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
        {replyingTo === comment.id && (
          <div className="flex flex-col gap-2">
            <textarea
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              rows={3}
              aria-label="Reply"
              data-testid="comment-reply-input"
              className="rounded-extra-small border border-outline p-2"
            />
            {replyFailed && (
              <p role="alert" data-testid="comment-reply-failed" className="text-body-small text-error">
                That didn&apos;t send. Try again.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                testId="comment-reply-submit"
                size="sm"
                onClick={() => void onSubmitReply()}
                disabled={replySubmitting || replyDraft.trim() === ""}
              >
                Sign reply
              </Button>
              <Button
                testId="comment-reply-cancel"
                variant="text"
                size="sm"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {replies.length > 0 && (
          <ul className="flex flex-col gap-3">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </ul>
        )}
        {thread?.loading === true && (
          <p data-testid={`replies-loading-${comment.id}`} className="text-body-small">
            Loading…
          </p>
        )}
        {thread?.failed === true && (
          <Button
            testId={`replies-retry-${comment.id}`}
            variant="text"
            size="sm"
            onClick={() => void onLoadMoreReplies(comment)}
          >
            Retry
          </Button>
        )}
        {repliesHaveMore && thread?.loading !== true && thread?.failed !== true && (
          <Button
            testId={`replies-more-${comment.id}`}
            variant="text"
            size="sm"
            onClick={() => void onLoadMoreReplies(comment)}
          >
            Show replies
          </Button>
        )}
      </li>
    );
  };

  const isOwnPost = viewerId !== null && post.author?.id === viewerId;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      {header(isOwnPost)}
      <div>
        {post.title.value && (
          <h1 className="text-headline-small" data-testid="post-title">
            {post.title.value}
          </h1>
        )}
        {post.description.value && (
          <p className="text-body-medium text-on-surface-variant">{post.description.value}</p>
        )}
      </div>
      <p className="whitespace-pre-wrap" data-testid="post-body">
        {post.content.value}
      </p>
      {post.author && (
        <ActorChip
          handle={post.author.handle}
          displayName={post.author.displayName.value}
          testId="post-author"
        />
      )}
      <LicenseTerms license={post.license} testId="post-license-terms" />
      {/* The post reads in full whether or not it has landed; the
          marker carries the difference (design.md §9). An unlanded edit
          marks the post too — the text on screen is that edit. */}
      {isPending(post) && <PendingMarker testId="post-pending" />}
      {/* Read-only here for everyone, the author included (F3): the
          author changes their tags on the edit screen, where the rest of
          the post is changed. */}
      <TopicChipRow topics={chipEntries(post.topics)} testIdPrefix="post" />
      {/* The post card's stance control, on the detail surface (design.md §6). */}
      <StanceControl target={{ id: postId, kind: "post", label: "this post" }} testIdPrefix="post-stance" />
      <hr className="border-outline-variant" />
      <h2 className="text-title-medium">Comments</h2>
      {/* A failed whole-post refresh; a failed comments page surfaces
          at the load-more slot below instead (web.md "Design
          guidelines", the Android twin). */}
      {transportFault === "refresh" && <TransportError testId="post-thread-transport-error" />}
      {comments.length === 0 && <p data-testid="post-no-comments">No comments yet.</p>}
      <ul className="flex flex-col gap-3">
        {comments.map((comment) => renderComment(comment, 0))}
      </ul>
      {hasMore &&
        (transportFault === "append" ? (
          <div className="flex items-center gap-3">
            <TransportError
              testId="post-more-comments-error"
              message="Can't reach the server — more comments can't load right now."
            />
            <Button
              testId="post-more-comments-retry"
              variant="outline"
              size="sm"
              onClick={() => void onLoadMore()}
              disabled={loadingMore}
            >
              Retry
            </Button>
          </div>
        ) : (
          <Button
            testId="post-more-comments"
            variant="outline"
            onClick={() => void onLoadMore()}
            disabled={loadingMore}
          >
            Load more
          </Button>
        ))}
      {phase === "signedOut" && (
        <Link
          href="/login"
          data-testid="comment-signin"
          className="self-start text-body-medium text-on-surface-variant underline"
        >
          Sign in or join to comment
        </Link>
      )}
      {phase === "signedIn" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="comment-draft" className="text-label-large">
            Add a comment
          </label>
          <textarea
            id="comment-draft"
            data-testid="comment-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="rounded-extra-small border border-outline p-2"
          />
          <LicenseChooser value={license} onChange={setLicense} testIdPrefix="comment" />
          {refusedMessage && (
            <p role="alert" data-testid="comment-refused" className="text-body-medium text-error">
              {refusedMessage}
            </p>
          )}
          {signIncomplete && (
            <SigningPending needsKey={signingNeedsKey} testIdPrefix="comment" />
          )}
          {submitFailed && <TransportError testId="comment-transport-error" />}
          {commentSigned && (
            <p data-testid="comment-signed" className="text-body-medium text-success">
              Signed — it&apos;s in the thread now, still settling.
            </p>
          )}
          <Button
            testId="comment-submit"
            onClick={() => void onSubmitComment()}
            disabled={submitting || draft.trim() === ""}
          >
            Sign comment
          </Button>
        </div>
      )}
    </main>
  );
}
