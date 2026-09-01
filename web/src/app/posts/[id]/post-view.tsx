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

import {
  fetchCommentReplies,
  fetchCommentSelfMark,
  fetchPostDetail,
  isPending,
  prepareCommentEdit,
  type CommentView,
  type PostDetail,
  type ReplyView,
} from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { prepareTag } from "@/lib/api/topics-api";
import { prepareReference, prepareReferenceWithdrawal } from "@/lib/api/references-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { tagChanges, WITHDRAWN_RELEVANCE, type TagDraft } from "@/lib/topics/draft";
import { referenceChipEntries, referenceDrafts } from "@/lib/references/claims";
import {
  referenceActs,
  referenceChanges,
  type ReferenceDraft,
} from "@/lib/references/draft";
import { ReferenceChipRow } from "@/lib/ui/reference-chip-row";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useConfirmMultiAction } from "@/lib/signing/confirm-multi-action";
import { useWriteSigner } from "@/lib/signing/provider";
import { ActorChip } from "@/lib/ui/actor-chip";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { LicenseTerms } from "@/lib/ui/license-fields";
import { PageHeader } from "@/lib/ui/page-header";
import { PendingMarker } from "@/lib/ui/pending-marker";
import {
  BodyRegion,
  PostMedia,
  bodyIsSensitive,
  hasMedia,
  sensitiveSignature,
} from "@/lib/ui/post-media";
import type { ReplyTarget } from "@/lib/compose/reply-wizard";
import { commentTarget, ReplyWizard } from "./reply/reply-wizard-view";
import { MultiActionConfirm, SignedActionsIndicator } from "@/lib/ui/signed-actions";
import { StanceControl } from "@/lib/ui/stance-control";
import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { TopicChipRow, type TopicChipEntry } from "@/lib/ui/topic-chip-row";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

/**
 * `TopicClaim[]` off any content node, projected down to the chip row's
 * shape. The detail view carries the values along (F8) — the row shows
 * them only once a reader asks.
 */
function chipEntries(
  topics: readonly {
    hashtag: { name: { value?: string | null } };
    pending: boolean;
    relevance: number;
    confidence: number;
  }[],
): readonly TopicChipEntry[] {
  return topics.map((claim) => ({
    name: claim.hashtag.name.value ?? "",
    pending: claim.pending,
    relevance: claim.relevance,
    confidence: claim.confidence,
  }));
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

/** A comment's claims as the tag section drafts them. */
function tagDrafts(
  topics: readonly {
    hashtag: { name: { value?: string | null } };
    relevance: number;
    confidence: number;
  }[],
): readonly TagDraft[] {
  return topics.map((claim) => ({
    name: claim.hashtag.name.value ?? "",
    relevance: claim.relevance,
    confidence: claim.confidence,
  }));
}

/** Which composer on this page a confirmation is standing in front of. */
type PendingSubmit = "edit";

/** What the thread hands the wizard when "Add a comment" is pressed. */
function postTarget(post: PostDetail["post"], postId: string): ReplyTarget {
  const name = post.author?.displayName.value?.trim();
  const handle = post.author?.handle ?? "";
  return {
    id: postId,
    kind: "post",
    label: post.title.value?.trim() || "this post",
    authorHandle: handle,
    authorName: name && name !== "" ? name : handle,
    avatarUrl: post.author?.avatar?.url ?? null,
    snippet: post.description.value ?? post.content.value ?? "",
  };
}

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

  // BOTH DOORS OPEN THE SAME WIZARD (ReplyEntry via=5 and via=7): "Reply" on a
  // comment pre-targets that comment, "Add a comment" at the foot of the thread
  // pins the post. What differs is the target, so that is all this holds — the
  // words, the pictures, the topics, the citations and the stance all live in
  // the wizard's own machine, and nothing of a discarded comment survives here.
  const [replying, setReplying] = useState<ReplyTarget | null>(null);
  const [commentSigned, setCommentSigned] = useState(false);

  // Reply threads expanded past their prefetched page, keyed by comment.
  const [replyThreads, setReplyThreads] = useState<Record<string, ReplyThread>>({});
  // The inline comment edit — the affordance renders on own comments
  // only. It carries what the comment LOADED with beside what the editor
  // holds now: the baseline both the tag changes and the "did the text
  // move at all" question read (F10, the post-edit precedent).
  const [editing, setEditing] = useState<{
    id: string;
    draft: string;
    loadedDraft: string;
    loadedTags: readonly TagDraft[];
    tags: readonly TagDraft[];
    loadedReferences: readonly ReferenceDraft[];
    references: readonly ReferenceDraft[];
    /** Carried forward so a complete-state edit cannot unveil the comment. */
    sensitive: boolean;
  } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFailed, setEditFailed] = useState(false);
  const [editRefusedMessage, setEditRefusedMessage] = useState<string | null>(null);
  const [editTagErrors, setEditTagErrors] = useState<Readonly<Record<number, string>>>({});
  const [editReferenceErrors, setEditReferenceErrors] = useState<
    Readonly<Record<number, string>>
  >({});
  // F4: a submit staging more than one act asks first. The two composers that
  // used to raise it now seal instead — ReplySeal names every act with its
  // price — so the edit is the one surface left that asks.
  const [confirmMultiAction, setConfirmMultiAction] = useConfirmMultiAction();
  const [confirming, setConfirming] = useState<PendingSubmit | null>(null);

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

  /**
   * Signs the WHOLE staged batch, never just its head: a comment that
   * mints with tags comes back as the record plus one act per tag, and
   * all of them are this device's to sign.
   */
  const signAll = async (writes: readonly StagedWriteView[]): Promise<boolean> => {
    const results = [];
    for (const staged of writes) {
      results.push(await signer.signStaged(staged));
    }
    return results.every((result) => result.kind === "done");
  };

  // What pressing each submit right now would sign (F4). A comment or a
  // reply mints its record and batches one act per drafted topic; an
  // edit signs the edit record only if the text moved, plus one act per
  // tag change.
  const editChanges = editing === null ? [] : tagChanges(editing.loadedTags, editing.tags);
  const editReferenceChanges =
    editing === null ? [] : referenceChanges(editing.loadedReferences, editing.references);
  const editTextChanged = editing !== null && editing.draft !== editing.loadedDraft;
  // A withdrawal is a whole counter-record batch, and the claim quotes
  // it: `withdrawalCost` comes off the raw bundle sums the clipped pair
  // has already lost, so this count is exact and every edit asks before
  // it prepares.
  const editActions =
    (editTextChanged ? 1 : 0) + editChanges.length + referenceActs(editReferenceChanges);

  /**
   * F10: prepares EVERYTHING before signing anything — a refusal on the
   * third tag must not leave the first two signed. The edit record is
   * staged only when the text actually moved (post-edit precedent);
   * staged writes nobody signs are collected by the server's own GC.
   */
  const runEdit = async () => {
    if (editing === null) return;
    setEditSubmitting(true);
    setEditFailed(false);
    setEditRefusedMessage(null);
    setEditTagErrors({});
    setEditReferenceErrors({});
    const writes: StagedWriteView[] = [];
    const perTag: Record<number, string> = {};
    const perReference: Record<number, string> = {};
    let general: string | null = null;

    if (editTextChanged) {
      const prepared = await guard.run(() =>
        prepareCommentEdit(client, {
          id: editing.id,
          content: editing.draft,
          // Re-stated, never omitted: the edit carries the whole state.
          sensitive: editing.sensitive,
        }),
      );
      if (prepared.kind === "failed") {
        setEditSubmitting(false);
        setEditFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        general = prepared.errors[0]?.message ?? "The server refused this write.";
      } else {
        writes.push(...prepared.value.writes);
      }
    }

    for (const change of editChanges) {
      const prepared = await guard.run(() =>
        prepareTag(client, {
          target: editing.id,
          name: change.kind === "tag" ? change.tag.name : change.name,
          // Withdrawing is a Tag act at relevance 0 (hashtag.md §4).
          relevance: change.kind === "tag" ? change.tag.relevance : WITHDRAWN_RELEVANCE,
          confidence: change.kind === "tag" ? change.tag.confidence : undefined,
        }),
      );
      if (prepared.kind === "failed") {
        setEditSubmitting(false);
        setEditFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        // A PRE-STAGING refusal is a field error, never the signing line
        // (F2). An added tag carries it on its own chip; a withdrawal has
        // no chip left to carry it, so it reads on the general line.
        const message = prepared.errors[0]?.message ?? "The server refused this write.";
        const index =
          change.kind === "tag"
            ? editing.tags.findIndex((tag) => tag.name === change.tag.name)
            : -1;
        if (index >= 0) perTag[index] = message;
        else general = general ?? message;
      } else {
        writes.push(...prepared.value);
      }
    }

    // One Reference act per added or re-tuned reference; a removal is a
    // WITHDRAWAL, whose counter-records the server assembles (D11).
    for (const change of editReferenceChanges) {
      const prepared = await guard.run(() =>
        change.kind === "reference"
          ? prepareReference(client, {
              artifact: editing.id,
              target: change.reference.targetId,
              relevance: change.reference.relevance,
              support: change.reference.support,
            })
          : prepareReferenceWithdrawal(client, {
              artifact: editing.id,
              target: change.reference.targetId,
            }),
      );
      if (prepared.kind === "failed") {
        setEditSubmitting(false);
        setEditFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        const message = prepared.errors[0]?.message ?? "The server refused this write.";
        const index =
          change.kind === "reference"
            ? editing.references.findIndex(
                (reference) => reference.targetId === change.reference.targetId,
              )
            : -1;
        if (index >= 0) perReference[index] = message;
        else general = general ?? message;
      } else {
        writes.push(...prepared.value);
      }
    }

    if (
      general !== null ||
      Object.keys(perTag).length > 0 ||
      Object.keys(perReference).length > 0
    ) {
      setEditSubmitting(false);
      setEditTagErrors(perTag);
      setEditReferenceErrors(perReference);
      setEditRefusedMessage(general);
      return;
    }

    const done = await signAll(writes);
    setEditSubmitting(false);
    if (done) {
      setEditing(null);
      setCommentSigned(true);
      refresh();
    } else {
      setEditFailed(true);
    }
  };

  const onSubmitEdit = async () => {
    if (editing === null || editSubmitting || editing.draft.trim() === "") return;
    if (editActions === 0) return;
    if (editActions > 1 && confirmMultiAction) {
      setConfirming("edit");
      return;
    }
    await runEdit();
  };

  /** The dialog's own numbers and the run it stands in front of. */
  const confirmed = () => ({ count: editActions, busy: editSubmitting, run: runEdit });

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
              avatarUrl={comment.author.avatar?.url}
              testId={`comment-author-${comment.id}`}
            />
          )}
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editing.draft}
                onChange={(event) =>
                  setEditing({ ...editing, draft: event.target.value })
                }
                rows={3}
                aria-label="Edit comment"
                data-testid="comment-edit-input"
                className="rounded-extra-small border border-outline p-2"
              />
              {/* F10: the same section the post edit carries — current
                  claims at their real values, each change its own act, so
                  the tags are not fields of the edit record (D14). No
                  batch here, so no batch cap. */}
              <TagEntryField
                tags={editing.tags}
                onChange={(tags) => setEditing({ ...editing, tags })}
                fieldErrors={editTagErrors}
                cap={null}
                testIdPrefix="comment-edit"
              />
              {/* The same section the composer carries — current
                  references at their real values, each change its own
                  act, so references are not fields of the edit record
                  (D14). Removing a chip stages a WITHDRAWAL, not a
                  deletion. No batch here, so no batch cap. */}
              <ReferenceEntryField
                references={editing.references}
                onChange={(references) => setEditing({ ...editing, references })}
                fieldErrors={editReferenceErrors}
                cap={null}
                testIdPrefix="comment-edit"
              />
              {editRefusedMessage && (
                <p
                  role="alert"
                  data-testid="comment-edit-refused"
                  className="text-body-small text-error"
                >
                  {editRefusedMessage}
                </p>
              )}
              {editFailed && (
                <p role="alert" data-testid="comment-edit-failed" className="text-body-small text-error">
                  That didn&apos;t save. Try again.
                </p>
              )}
              <SignedActionsIndicator
                count={editActions}
                testId="comment-edit-signed-actions"
              />
              <div className="flex gap-2">
                <Button
                  testId="comment-edit-save"
                  size="sm"
                  onClick={() => void onSubmitEdit()}
                  disabled={
                    editSubmitting || editing.draft.trim() === "" || editActions === 0
                  }
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
              {/* A comment is text PLUS optional media — the XOR is the post's
                  rule alone (D16) — so both render, and both are veiled as one
                  body when the comment is marked. */}
              <BodyRegion
                veiled={bodyIsSensitive(comment)}
                testId={`comment-${comment.id}`}
                nodeId={comment.id}
                signature={sensitiveSignature(comment)}
              >
                <p className="text-body-medium">{comment.content.value}</p>
                {/* A COMMENT IS WORDS FIRST and its pictures join them: below
                    the words, INSET at the card's medium rung rather than
                    full-bleed (they are an attachment, not the body), and
                    capped at comment scale so a comment never turns into a
                    post. Comment pictures never crop, so multiples share a
                    fixed square frame and each whole frame fits inside it. */}
                {hasMedia(comment) && (
                  <PostMedia
                    node={comment}
                    bleed="none"
                    radius="var(--radius-medium)"
                    ratio={comment.attachments.length > 1 ? 1 : undefined}
                    maxHeight="220px"
                    testId={`comment-media-${comment.id}`}
                  />
                )}
              </BodyRegion>
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
                  the plain, tappable chip row (design.md §6) — here on
                  the detail surface, with the F8 values toggle. */}
              <TopicChipRow
                topics={chipEntries(comment.topics)}
                testIdPrefix={`comment-${comment.id}`}
                revealable
              />
              {/* The reference row under the body (D16), with the
                  values toggle this detail surface offers. */}
              <ReferenceChipRow
                references={referenceChipEntries(comment.references)}
                testIdPrefix={`comment-${comment.id}`}
                revealable
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
                      // ReplyEntry via=5: the composer, PRE-TARGETED at this
                      // comment. The other door — "Add a comment" at the foot
                      // of the thread — pins the post instead.
                      setReplying(commentTarget(comment));
                      setEditing(null);
                    }}
                  >
                    Reply
                  </Button>
                )}
                {/* D20's Reference affordance: the word is Reference,
                    never "cite". It opens the composer with this
                    comment already drafted as a chip. */}
                {phase === "signedIn" && (
                  <Link
                    href={`/compose?reference=${comment.id}`}
                    data-testid={`comment-reference-${comment.id}`}
                    className={buttonClassName({ variant: "text", size: "sm" })}
                  >
                    Reference
                  </Link>
                )}
                {isOwn && (
                  <Button
                    testId={`comment-edit-${comment.id}`}
                    variant="text"
                    size="sm"
                    onClick={() => {
                      // The editor opens on what the comment actually
                      // carries — text and claims alike — so an untouched
                      // editor stages nothing (F10).
                      const loadedDraft = comment.content.value ?? "";
                      const loaded = tagDrafts(comment.topics);
                      // A claim CoGra cannot type has no L2 id to name
                      // it back by, so it is left out of the section —
                      // never staged, never read as a removal.
                      const loadedRefs = referenceDrafts(comment.references);
                      setEditing({
                        id: comment.id,
                        draft: loadedDraft,
                        loadedDraft,
                        loadedTags: loaded,
                        tags: loaded,
                        loadedReferences: loadedRefs,
                        references: loadedRefs,
                        // The OR is what a READER sees; the switch is the
                        // author's own mark and arrives from its own read a
                        // moment later (round 4). Starting from the OR would
                        // show a moderator's verdict as the author's until it
                        // landed, so the switch starts unmarked and the read
                        // is what turns it on.
                        sensitive: false,
                      });
                      void fetchCommentSelfMark(client, comment.id).then((outcome) => {
                        if (outcome.kind !== "success") return;
                        const mark = outcome.value;
                        if (mark === null) return;
                        setEditing((current) =>
                          current === null || current.id !== comment.id
                            ? current
                            : { ...current, sensitive: mark },
                        );
                      });
                      setEditTagErrors({});
                      setEditReferenceErrors({});
                      setEditRefusedMessage(null);
                      setEditFailed(false);
                      setReplying(null);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
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
      {/* The title stands outside the veil and above the gallery; everything
          else in the body region is veiled as one (D12). */}
      {post.title.value && (
        <h1 className="text-headline-small" data-testid="post-title">
          {post.title.value}
        </h1>
      )}
      <BodyRegion
        veiled={bodyIsSensitive(post)}
        testId="post"
        nodeId={post.id}
        signature={sensitiveSignature(post)}
      >
        {hasMedia(post) && (
          <PostMedia node={post} testId="post-media" bleed="page" preloadLead />
        )}
        {post.description.value && (
          <p className="text-body-medium text-on-surface-variant">{post.description.value}</p>
        )}
        {/* Null on a media post, whose body is its gallery. */}
        {post.content.value && (
          <p className="whitespace-pre-wrap" data-testid="post-body">
            {post.content.value}
          </p>
        )}
      </BodyRegion>
      {post.author && (
        <ActorChip
          handle={post.author.handle}
          displayName={post.author.displayName.value}
          avatarUrl={post.author.avatar?.url}
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
      <TopicChipRow topics={chipEntries(post.topics)} testIdPrefix="post" revealable />
      {/* Read-only here for everyone, the author included: references
          are changed on the edit screen, where the rest of the post is
          changed. The values toggle is this detail surface's (D16). */}
      <ReferenceChipRow
        references={referenceChipEntries(post.references)}
        testIdPrefix="post"
        revealable
      />
      {/* D20's Reference affordance on the post itself. */}
      {phase === "signedIn" && (
        <Link
          href={`/compose?reference=${postId}`}
          data-testid="post-reference"
          className={`self-start ${buttonClassName({ variant: "outline", size: "sm" })}`}
        >
          Reference
        </Link>
      )}
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
      {commentSigned && (
        <p data-testid="comment-signed" className="text-body-medium text-success">
          Signed — it&apos;s in the thread now, still settling.
        </p>
      )}
      {/* ReplyEntry's entry row, pinned at the foot of the thread: the door
          that pins the POST as what the comment answers. The board draws the
          viewer's own avatar beside it; drawing one here would mean a profile
          read this page does not otherwise make, which is exactly the cost
          the read restructure is removing, so the row is the field alone. */}
      {phase === "signedIn" && (
        <div
          data-testid="comment-entry"
          className="flex items-center gap-3 border-t border-outline-variant pt-3"
        >
          <button
            type="button"
            data-testid="comment-add"
            onClick={() => setReplying(postTarget(post, postId))}
            className="cg-state cg-focus min-h-14 flex-1 rounded-extra-small border border-outline px-3 text-left text-body-large text-on-surface-variant"
          >
            Add a comment
          </button>
        </div>
      )}
      {/* The wizard is a surface OVER the thread, and every way out of it
          comes back here — which is why the thread keeps its scroll, its
          unfolded branches, and the target's own name while it is open. */}
      {replying !== null && (
        <ReplyWizard
          target={replying}
          store={store}
          onLeave={() => setReplying(null)}
          onSigned={() => {
            setReplying(null);
            setCommentSigned(true);
            refresh();
          }}
        />
      )}
      {confirming !== null && (
        <MultiActionConfirm
          count={confirmed().count}
          busy={confirmed().busy}
          testIdPrefix="comment-edit"
          onCancel={() => setConfirming(null)}
          onConfirm={(stopAsking) => {
            const proceed = confirmed().run;
            if (stopAsking) setConfirmMultiAction(false);
            setConfirming(null);
            void proceed();
          }}
        />
      )}
    </main>
  );
}
