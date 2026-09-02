"use client";

// One post and its direct thread (comment.md §2). A signed comment is already
// its author's content (substrate.md §6), so the thread re-reads and the author
// finds it in place under the pending marker — only L1 finality is still
// outstanding.
//
// THE PAGE READS; THE WIZARDS WRITE. Both doors into the composer — Reply on a
// comment, "Add a comment" at the foot — open the reply wizard over this
// surface, and Edit opens the comment editor the same way. Everything a
// half-written comment holds lives in those, so the thread keeps only what it
// is showing: the post, a page of comments, and whichever branches a reader has
// unfolded.
//
// A BRANCH IS A COUNT UNTIL SOMEONE ASKS (Q49). The read carries no replies at
// all; `CommentConnection.totalCount` draws the "View n replies" line, and
// unfolding one is its own request.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  commentHasVideo,
  hasMedia,
  sensitiveSignature,
} from "@/lib/ui/post-media";
import type { ReplyTarget } from "@/lib/compose/reply-wizard";
import {
  addTo,
  addedAssets,
  editBlocked,
  editClaims,
  galleryChanged,
  galleryOf,
  keptPreviews,
  pictureAltText,
  pictureId,
  removeFrom as removeFromGallery,
  withAltText,
  withUpload,
  type EditGallery,
} from "@/lib/compose/comment-edit";
import { runUpload } from "@/lib/compose/uploads";
import { usePreviewUrls } from "@/lib/compose/previews";
import { DescribeSheet } from "@/lib/ui2/compose/describe-sheet";
import { HelpDialog, HELP_TOPICS } from "@/lib/ui2/help-dialog";
import { commentTarget, ReplyWizard } from "./reply/reply-wizard-view";
import { CommentEditView } from "./edit/comment-edit-view";
import { MultiActionConfirm } from "@/lib/ui/signed-actions";
import { StanceControl } from "@/lib/ui/stance-control";
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

/**
 * The thread is two levels deep on screen: a comment, and its replies
 * indented once (design/readme.md §13, 2026-08-28, and the canonical
 * `CommentCard`, which sets exactly this — matched by Android's
 * `PostDetailScreen.kt` since PR #574). Anything deeper flattens into that
 * one reply level; the @handle it answers is already part of the reply's
 * own content, prefilled by the composer, not generated here. design.md §6
 * still says three levels; it predates the ruling (design/backlog.md item
 * 26 tracks that lag).
 */
const MAX_INDENT_DEPTH = 1;

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

/**
 * How many replies a comment's branch holds, across every page (Q49).
 *
 * `totalCount` is cursor-independent and counted under the same
 * `includePending` filter that would serve the edges, so the collapsed line
 * promises exactly what unfolding delivers.
 */
function replyCount(comment: ThreadComment): number {
  return comment.replies.totalCount;
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
    /** The gallery as the comment carried it, and as the editor holds it now. */
    loadedGallery: EditGallery;
    gallery: EditGallery;
    /** What the comment is on, for the editor's lede. */
    targetLabel: string;
    /** Carried forward so a complete-state edit cannot unveil the comment. */
    sensitive: boolean;
  } | null>(null);
  const [editDescribing, setEditDescribing] = useState<string | null>(null);
  const [editActsOpen, setEditActsOpen] = useState(false);
  const [editHelp, setEditHelp] = useState(false);
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

  // ---- the edit's own pictures --------------------------------------------

  // A kept picture is already on the server, so only the ADDED ones are handed
  // to `runUpload`; the ref guards React's double mount in development.
  // Memoised so the preview hook and the upload effect see one stable array
  // rather than a fresh one on every keystroke in the words field.
  const editAdded = useMemo(
    () => (editing === null ? [] : addedAssets(editing.gallery)),
    [editing],
  );
  const editPickedPreviews = usePreviewUrls(editAdded);
  const startedEditUploads = useRef(new Set<string>());

  useEffect(() => {
    for (const asset of editAdded) {
      if (asset.upload.kind !== "waiting" || startedEditUploads.current.has(asset.id)) continue;
      startedEditUploads.current.add(asset.id);
      // No ratio: a comment's pictures keep their own shape, on an edit as on
      // a compose.
      void runUpload(client, asset, undefined, (upload) =>
        setEditing((current) =>
          current === null ? current : { ...current, gallery: withUpload(current.gallery, asset.id, upload) },
        ),
      );
    }
  }, [editAdded, client]);

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
    // A branch starts EMPTY now (Q49): the thread read carries counts, not
    // pages, so the first unfold is the first read of these nodes.
    const seeded = replyThreads[comment.id] ?? {
      items: [],
      endCursor: null,
      hasMore: false,
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
  // The edit record carries the body AND the gallery, so either moving is what
  // stages it — a comment whose only change was a removed picture still has to
  // write one, or the removal never happens.
  const editGalleryMoved =
    editing !== null && galleryChanged(editing.loadedGallery, editing.gallery);
  const editTextChanged =
    editing !== null && (editing.draft !== editing.loadedDraft || editGalleryMoved);
  // A withdrawal is a whole counter-record batch, and the claim quotes
  // it: `withdrawalCost` comes off the raw bundle sums the clipped pair
  // has already lost, so this count is exact and every edit asks before
  // it prepares.
  const editActions =
    (editTextChanged ? 1 : 0) + editChanges.length + referenceActs(editReferenceChanges);
  const editGateReason = editing === null ? null : editBlocked(editing.gallery);

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
          // Re-stated, never omitted: the edit carries the whole state — the
          // gallery for the same reason as the mark.
          attachments: editClaims(editing.gallery) ?? undefined,
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
    const replies = thread?.items ?? [];
    const repliesHaveMore = thread?.hasMore ?? false;
    // Collapsed until a reader asks: the branch is a count on the wire, and
    // the count is all the line needs to promise.
    const branch = replyCount(comment);
    const unopened = thread === undefined && branch > 0;
    const isOwn = viewerId !== null && comment.author?.id === viewerId;
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
                    // A VIDEO TAKES THE SQUARE TOO (ReplyMedia). The pager's
                    // one frame is what keeps a thread's rhythm steady, and a
                    // clip that set its own height would break it exactly where
                    // the reader is scrolling past.
                    ratio={
                      comment.attachments.length > 1 || commentHasVideo(comment) ? 1 : undefined
                    }
                    maxHeight="220px"
                    // One control, the sound; no transport bar and no duration
                    // pill on a surface meant for reading.
                    surface="reading"
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
                      const loadedGallery = galleryOf(comment.attachments);
                      setEditing({
                        id: comment.id,
                        draft: loadedDraft,
                        loadedDraft,
                        loadedTags: loaded,
                        tags: loaded,
                        loadedReferences: loadedRefs,
                        references: loadedRefs,
                        loadedGallery,
                        gallery: loadedGallery,
                        targetLabel: post.title.value?.trim() || "this post",
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
        {/* The collapsed branch, as CommentCard draws it: a short rule and the
            count, indented under the comment, so the thread stays scannable and
            a reader opens only the branches they mean to read. Once it is open
            the line becomes the ordinary "more" affordance for the next page. */}
        {unopened && (
          <button
            type="button"
            data-testid={`replies-more-${comment.id}`}
            onClick={() => void onLoadMoreReplies(comment)}
            className="cg-state cg-focus cg-hit ml-7 flex items-center gap-3 self-start border-0 bg-transparent py-1 pl-0 pr-2 text-label-medium text-on-surface-variant"
          >
            <span aria-hidden="true" className="h-px w-6 bg-outline-variant" />
            View {branch === 1 ? "1 reply" : `${branch} replies`}
          </button>
        )}
        {!unopened && repliesHaveMore && thread?.loading !== true && thread?.failed !== true && (
          <Button
            testId={`replies-more-${comment.id}`}
            variant="text"
            size="sm"
            onClick={() => void onLoadMoreReplies(comment)}
          >
            Show more replies
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
      {/* CommentEdit, over the thread for the same reasons the wizard is. */}
      {editing !== null && (
        <>
          <CommentEditView
            targetLabel={editing.targetLabel}
            words={editing.draft}
            gallery={editing.gallery}
            previews={{ ...keptPreviews(editing.gallery), ...editPickedPreviews }}
            tags={editing.tags}
            references={editing.references}
            tagErrors={editTagErrors}
            referenceErrors={editReferenceErrors}
            acts={editActions}
            actsOpen={editActsOpen}
            busy={editSubmitting}
            blocked={editGateReason}
            refusal={editRefusedMessage}
            failed={editFailed}
            onWords={(draft) => setEditing({ ...editing, draft })}
            onPick={(files) =>
              setEditing({
                ...editing,
                gallery: addTo(
                  editing.gallery,
                  files.map((file) => ({ id: crypto.randomUUID(), file })),
                ),
              })
            }
            onRemovePicture={(id) =>
              setEditing({ ...editing, gallery: removeFromGallery(editing.gallery, id) })
            }
            onDescribe={setEditDescribing}
            onTags={(tags) => setEditing({ ...editing, tags })}
            onReferences={(references) => setEditing({ ...editing, references })}
            onActs={setEditActsOpen}
            onHelp={() => setEditHelp(true)}
            onSign={() => void onSubmitEdit()}
            onLeave={() => setEditing(null)}
          />
          {/* One picture at a time, keyed by id: comments have no in-sheet
              stepping, on the editor as on the composer. */}
          <DescribeSheet
            open={editDescribing !== null}
            onClose={() => setEditDescribing(null)}
            src={
              editDescribing === null
                ? null
                : ({ ...keptPreviews(editing.gallery), ...editPickedPreviews }[editDescribing] ??
                  null)
            }
            crop={null}
            value={
              editDescribing === null
                ? ""
                : (editing.gallery
                    .filter((picture) => pictureId(picture) === editDescribing)
                    .map(pictureAltText)[0] ?? "")
            }
            onChange={(altText) => {
              if (editDescribing !== null) {
                setEditing({
                  ...editing,
                  gallery: withAltText(editing.gallery, editDescribing, altText),
                });
              }
            }}
            position={{
              index: editing.gallery.findIndex(
                (picture) => pictureId(picture) === editDescribing,
              ),
              total: editing.gallery.length,
            }}
            testId="comment-edit-describe-sheet"
          />
          <HelpDialog
            open={editHelp}
            onClose={() => setEditHelp(false)}
            topic={HELP_TOPICS.editing}
            testId="comment-edit-help-dialog"
          />
        </>
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
