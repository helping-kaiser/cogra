"use client";

// THE COMMENTS SHEET IS THE ONE COMMENTS SURFACE (jakob 2026-09-15).
//
// A post's thread used to be a region of the post page, reading out of the
// detail's own state — which made it unraisable anywhere the detail was not
// already loaded. The count on a feed card raises THIS, the same full-function
// thread the detail's count raises: reply, the comment's ⋮, edit, license, and
// the branches a reader unfolds.
//
// SO THE THREAD OWNS ITSELF. The surfaces underneath stay presentational: they
// say which post's count was tapped and whether the sheet is up, and nothing
// else. Everything the thread is — its page, its expanded branches, its two
// composers and the sheets those raise — lives here, so both doors get the
// same surface rather than two that drift.
//
// A BRANCH IS A COUNT UNTIL SOMEONE ASKS (Q49). The read carries no replies at
// all; `CommentConnection.totalCount` draws the "View n replies" line, and
// unfolding one is its own request.
//
// THE COMPOSER TAKES THE SCREEN, AND GIVES IT BACK WHOLE. See `depart` and
// `restoring` below: the return is two values — where the reader was, and
// which comment the new reply hangs under — and it is a property of THIS
// surface, so it reads the same raised from the feed as from the detail.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import {
  fetchCommentReplies,
  fetchCommentSelfMark,
  fetchPostComments,
  isPending,
  prepareCommentEdit,
  type CommentView,
  type PostView,
  type ReplyView,
} from "@/lib/api/content-api";
import { firstRefusalMessage } from "@/lib/ui/error-messages";
import { appendDeduped } from "@/lib/api/pagination";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { prepareTag } from "@/lib/api/topics-api";
import {
  fetchCitedBy,
  prepareReference,
  prepareReferenceWithdrawal,
  type CitingRecordView,
} from "@/lib/api/references-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { tagChanges, WITHDRAWN_RELEVANCE, type TagDraft } from "@/lib/topics/draft";
import { referenceDrafts } from "@/lib/references/claims";
import {
  referenceActs,
  referenceChanges,
  type ReferenceDraft,
} from "@/lib/references/draft";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useConfirmMultiAction } from "@/lib/signing/confirm-multi-action";
import { useWriteSigner } from "@/lib/signing/provider";
import { ActorChip } from "@/lib/ui/actor-chip";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import type { License } from "@/lib/license";
import { PendingMarker } from "@/lib/ui/pending-marker";
import { useMeasureEffect } from "@/lib/ui/measure-effect";
import {
  ANCHOR_ATTRIBUTE,
  driftOf,
  measureAnchors,
  placeOf,
  topOfAnchor,
  type ScrollPlace,
} from "@/lib/ui/scroll-pin";
import {
  BodyRegion,
  PostMedia,
  bodyIsSensitive,
  hasMedia,
  sensitiveSignature,
} from "@/lib/ui/post-media";
import { shortTimestamp } from "@/lib/ui/timestamp";
import { TopicsLine } from "@/lib/ui/topics-line";
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
import { sensitiveReasonProblem } from "@/lib/compose/wizard";
import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { DescribeSheet } from "@/lib/ui2/compose/describe-sheet";
import { HelpDialog, HELP_TOPICS, type HelpTopic } from "@/lib/ui2/help-dialog";
import { CitedBySheet } from "@/lib/ui2/cited-by-sheet";
import { LicenseSheet } from "@/lib/ui2/license-sheet";
import { OverflowMenu, type MenuItem } from "@/lib/ui2/overflow-menu";
import { commentTarget, ReplyWizard } from "@/app/posts/[id]/reply/reply-wizard-view";
import { CommentEditView } from "@/app/posts/[id]/edit/comment-edit-view";
import { MultiActionConfirm } from "@/lib/ui/signed-actions";
import { StanceControl } from "@/lib/ui/stance-control";
import { Snackbar } from "@/lib/ui/snackbar";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

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

/** A reader who has not scrolled the thread is at its top. */
const TOP: ScrollPlace = { offset: 0, anchorId: null, anchorTop: 0 };

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

/** What the thread hands the wizard when "Add a comment" is pressed. */
function postTarget(post: PostView): ReplyTarget {
  const name = post.author?.displayName.value?.trim();
  const handle = post.author?.handle ?? "";
  return {
    id: post.id,
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

/** Which composer on this surface a confirmation is standing in front of. */
type PendingSubmit = "edit";

/**
 * What the sheet has to be given back when a composer hands the screen over.
 *
 * TWO VALUES, because one cannot restore the return. The place is where the
 * reader was reading; `unfolding` names the comment the new reply hangs under,
 * whose branch is behind a collapsed count until it is asked for — so a
 * refetch alone would land the reader on a thread that looks unchanged. Null
 * is a comment on the post itself, which is already at the top level.
 */
type Return = { place: ScrollPlace; unfolding: string | null };

export function CommentsSheet({
  open,
  onOpenChange,
  post,
  store = identityStore,
}: {
  open: boolean;
  /**
   * Raised and dropped. The sheet drives this itself as well as the surface
   * does: it yields the screen to a composer and takes it back, and both
   * halves of that are this one flag.
   */
  onOpenChange: (open: boolean) => void;
  /** The post whose thread this is — whichever surface's count was tapped. */
  post: PostView;
  /** Test injection, for the composer this sheet opens. */
  store?: IdentityStore;
}) {
  const client = useApolloClient();
  const router = useRouter();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const viewerId = useActiveAccountId();
  const phase = useAuthPhase();

  const [comments, setComments] = useState<readonly CommentView[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transportFault, setTransportFault] = useState<TransportFault | null>(null);

  // BOTH DOORS OPEN THE SAME WIZARD (ReplyEntry via=5 and via=7): "Reply" on a
  // comment pre-targets that comment, "Add a comment" at the foot of the thread
  // pins the post. What differs is the target, so that is all this holds — the
  // words, the pictures, the topics, the citations and the stance all live in
  // the wizard's own machine, and nothing of a discarded comment survives here.
  const [replying, setReplying] = useState<ReplyTarget | null>(null);
  const [commentSigned, setCommentSigned] = useState(false);
  // THE LICENSE IS NEVER A STATE OF THE CARD (`ReaderPostMenu.jsx:27-29`): one
  // sheet for the thread, raised by whichever comment's menu row asked for it.
  // The license it shows outlives the `open` flag so the block does not blank
  // out mid-exit. Raised from inside the thread it is always a sheet over a
  // sheet, `stacked` (design/readme.md:2364) — the post's own row raises the
  // page's copy instead, which is not this one.
  const [licenseShown, setLicenseShown] = useState<License | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  // The comment's ⋮ row, same rule: over the thread, so always stacked.
  const [citedByNode, setCitedByNode] = useState<string | null>(null);
  const [citedByRecords, setCitedByRecords] = useState<readonly CitingRecordView[]>([]);
  const [citedByCursor, setCitedByCursor] = useState<string | null>(null);
  const [citedByHasMore, setCitedByHasMore] = useState(false);
  const [citedByLoadingMore, setCitedByLoadingMore] = useState(false);
  // Stable, so the snackbar's own timer is not restarted by every render of
  // the thread underneath it.
  const dismissCommentSigned = useCallback(() => setCommentSigned(false), []);

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
    /** The author's own mark as the editor found it, and as it holds it now. */
    loadedSensitive: boolean;
    loadedSensitiveReason: string;
    sensitive: boolean;
    sensitiveReason: string;
  } | null>(null);
  const [editDescribing, setEditDescribing] = useState<string | null>(null);
  const [editActsOpen, setEditActsOpen] = useState(false);
  // The editor has two help doors — the header's "Editing" and the mark
  // sheet's "?" — so the state is which topic is open, not whether one is.
  const [editHelp, setEditHelp] = useState<HelpTopic | null>(null);
  const [editSensitiveOpen, setEditSensitiveOpen] = useState(false);
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

  // ---- where the reader was -----------------------------------------------

  // The scrolling body of the sheet, which is the scroller the thread moves in
  // — not the page under it, which never scrolls while the sheet is up.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // Kept current as the reader scrolls, so departing costs no render. It is a
  // PLACE, not an offset: the return lands into a thread that is still
  // arriving — a refetched page, a branch unfolding — and every one of those
  // lands above what the reader was reading and shoves it (`scroll-pin.ts`).
  const place = useRef<ScrollPlace>(TOP);
  const [restoring, setRestoring] = useState<Return | null>(null);

  /** Read the reader's place off the body, as it stands right now. */
  const measurePlace = useCallback(() => {
    const scroller = bodyRef.current;
    if (scroller === null) return;
    place.current = placeOf(scroller.scrollTop, measureAnchors(scroller));
  }, []);

  // A CLOSED DIALOG IS `display: none`, and the browser drops the offset it
  // was holding — so the place has to be taken before the sheet goes down,
  // not read back off the body afterwards.
  const depart = useCallback(() => {
    measurePlace();
    onOpenChange(false);
  }, [measurePlace, onOpenChange]);

  useEffect(() => {
    const scroller = bodyRef.current;
    if (scroller === null || !open) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      // Measured on the way past rather than on unmount: one measurement per
      // frame is cheaper than a render, and a mobile browser may never run an
      // unmount at all.
      requestAnimationFrame(() => {
        measurePlace();
        ticking = false;
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [open, measurePlace]);

  // ---- the thread's own read ----------------------------------------------

  /**
   * A branch, unfolded from nothing.
   *
   * Only ever called straight after a read, which clears every expansion — so
   * the branch starts empty and this needs none of the paging state the
   * reader-driven expand below reads.
   */
  const unfoldFresh = useCallback(
    (commentId: string) => {
      setReplyThreads((current) => ({
        ...current,
        [commentId]: {
          items: [],
          endCursor: null,
          hasMore: false,
          loading: true,
          failed: false,
        },
      }));
      void fetchCommentReplies(client, commentId).then((outcome) => {
        setReplyThreads((current) => ({
          ...current,
          [commentId]:
            outcome.kind === "success"
              ? {
                  items: outcome.value.items,
                  endCursor: outcome.value.endCursor,
                  hasMore: outcome.value.hasNextPage,
                  loading: false,
                  failed: false,
                }
              : {
                  items: [],
                  endCursor: null,
                  hasMore: false,
                  loading: false,
                  failed: true,
                },
        }));
      });
    },
    [client],
  );

  const read = useCallback(
    (unfold: string | null = null) => {
      setLoading(true);
      void fetchPostComments(client, post.id).then((outcome) => {
        setLoading(false);
        if (outcome.kind !== "success") {
          // The thread is what failed, so the fault reads where the thread is
          // — inside the sheet, over the surface below.
          setTransportFault("refresh");
          return;
        }
        setTransportFault(null);
        const thread = outcome.value;
        setComments(thread?.items ?? []);
        setEndCursor(thread?.endCursor ?? null);
        setHasMore(thread?.hasNextPage ?? false);
        // A page is a snapshot, not a live view (api-spec.md): the refetched
        // thread is a new set of nodes, so unfolded branches start over rather
        // than hanging off ids this page may not carry.
        setReplyThreads({});
        if (unfold !== null) unfoldFresh(unfold);
      });
    },
    [client, post.id, unfoldFresh],
  );

  // WHICH THREAD THIS IS. One sheet answers whichever count was tapped, so it
  // binds by post: a second raise of the same thread keeps what is already on
  // screen — the branches a reader unfolded included — and a raise of a
  // different one starts over. The read waits for the raise, because a thread
  // nobody asked for is a page nobody reads.
  const bound = useRef<string | null>(null);
  useEffect(() => {
    if (!open || bound.current === post.id) return;
    bound.current = post.id;
    setComments([]);
    setEndCursor(null);
    setHasMore(false);
    setReplyThreads({});
    setTransportFault(null);
    place.current = TOP;
    read();
  }, [open, post.id, read]);

  // PUT THE READER BACK, AND HOLD THEM THERE WHILE THE THREAD LANDS. The
  // refetch and the unfolding branch both arrive after the sheet is back up,
  // and both change what sits above the reader — so this re-corrects on every
  // landing, against the anchor rather than the bare offset, and lets go only
  // once the branch the reply landed in is standing.
  useMeasureEffect(() => {
    if (restoring === null || !open || loading || comments.length === 0) return;
    const scroller = bodyRef.current;
    if (scroller === null) return;
    const target = restoring.place;
    scroller.scrollTop = target.offset;
    const drift = driftOf(target, topOfAnchor(scroller, target.anchorId));
    if (drift !== 0) scroller.scrollTop += drift;
    measurePlace();
    const branch = restoring.unfolding;
    if (branch === null || replyThreads[branch]?.loading === false) setRestoring(null);
  }, [restoring, open, loading, comments, replyThreads, measurePlace]);

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
      void runUpload(client, guard, asset, undefined, (upload) =>
        setEditing((current) =>
          current === null
            ? current
            : { ...current, gallery: withUpload(current.gallery, asset.id, upload) },
        ),
      );
    }
  }, [editAdded, client, guard]);

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const outcome = await fetchPostComments(client, post.id, endCursor);
    setLoadingMore(false);
    if (outcome.kind !== "success") {
      setTransportFault("append");
      return;
    }
    if (outcome.value === null) return;
    setTransportFault(null);
    const next = outcome.value;
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
   * Both doors into the cited-by sheet from here are one door: a comment's ⋮
   * row. It is raised from inside the thread, so it always stacks.
   */
  const openCitedBy = (nodeId: string) => {
    setCitedByNode(nodeId);
    setCitedByRecords([]);
    setCitedByCursor(null);
    setCitedByHasMore(false);
    void fetchCitedBy(client, nodeId).then((outcome) => {
      if (outcome.kind !== "success") return;
      setCitedByRecords(outcome.value.items);
      setCitedByCursor(outcome.value.endCursor);
      setCitedByHasMore(outcome.value.hasNextPage);
    });
  };

  const onLoadMoreCitedBy = async () => {
    if (citedByNode === null || citedByLoadingMore || !citedByHasMore) return;
    setCitedByLoadingMore(true);
    const outcome = await fetchCitedBy(client, citedByNode, citedByCursor);
    setCitedByLoadingMore(false);
    if (outcome.kind !== "success") return;
    setCitedByRecords((current) => appendDeduped(current, outcome.value.items));
    setCitedByCursor(outcome.value.endCursor);
    setCitedByHasMore(outcome.value.hasNextPage);
  };

  /**
   * Signs the WHOLE staged batch, never just its head: a comment that
   * mints with tags comes back as the record plus one act per tag, and
   * all of them are this device's to sign.
   */
  const signAll = async (writes: readonly StagedWriteView[]): Promise<boolean> => {
    const results = await signer.sign(writes);
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
  // The mark is a term of the same record, so moving it stages the edit the
  // way the body and the gallery do — a comment whose only change is the
  // author's own mark still has to write one, or the mark never moves. The
  // reason counts only where it is shown: on an unmarked comment it is not
  // sent at all.
  const editMarkMoved =
    editing !== null &&
    (editing.sensitive !== editing.loadedSensitive ||
      (editing.sensitive && editing.sensitiveReason !== editing.loadedSensitiveReason));
  const editTextChanged =
    editing !== null &&
    (editing.draft !== editing.loadedDraft || editGalleryMoved || editMarkMoved);
  // A withdrawal is a whole counter-record batch, and the claim quotes
  // it: `withdrawalCost` comes off the raw bundle sums the clipped pair
  // has already lost, so this count is exact and every edit asks before
  // it prepares.
  const editActions =
    (editTextChanged ? 1 : 0) + editChanges.length + referenceActs(editReferenceChanges);
  // The reason answers to its cap only while the mark is on: an unmarked
  // edit's reason is never sent (`sensitiveInput`), so a leftover over-length
  // reason from a mark switched back off must not hold up an edit that no
  // longer carries it.
  const editGateReason =
    editing === null
      ? null
      : (editBlocked(editing.gallery, editing.draft) ??
        (editing.sensitive ? sensitiveReasonProblem(editing.sensitiveReason) : null));

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
          sensitiveReason: editing.sensitiveReason,
        }),
      );
      if (prepared.kind === "failed") {
        setEditSubmitting(false);
        setEditFailed(true);
        return;
      }
      if (prepared.kind === "refused") {
        general = firstRefusalMessage(prepared.errors, "The server refused this write.");
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
        const message = firstRefusalMessage(prepared.errors, "The server refused this write.");
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
        const message = firstRefusalMessage(prepared.errors, "The server refused this write.");
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
      // The edit settles IN THE THREAD (`CommentEdit` 12 → the thread), so
      // the sheet comes back up with it and the snackbar reads over it.
      //
      // AN EDIT KNOWS NO PARENT. The editor was opened on a comment, not on a
      // branch, so the return carries the place alone and a branch the reader
      // had unfolded around it re-collapses. The reply path — which does know
      // what it hangs under — gets the whole ruling; this half waits on
      // jakob's question about where an edit's own return should land.
      landed(null);
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

  const openLicense = (license: License) => {
    setLicenseShown(license);
    setLicenseOpen(true);
  };

  /**
   * THE THREAD YIELDS TO THE COMPOSER (ReplyEntry via=5 and via=7 advance to
   * `ReplyCompose`). The wizard and the editor are full-focus surfaces over
   * the page, so a sheet left open behind one would be a second surface
   * claiming the screen — and an open sheet is a modal dialog, which would
   * leave the wizard beneath it inert. The reader's place is taken on the way
   * out, because a closed dialog no longer holds one.
   */
  const openComposer = (target: ReplyTarget) => {
    depart();
    setEditing(null);
    setReplying(target);
  };

  /** ...AND TAKES ITS PLACE BACK, whole. Both composers' exits land here. */
  const backToThread = (returned: Return) => {
    setReplying(null);
    setEditing(null);
    setRestoring(returned);
    onOpenChange(true);
  };

  /**
   * A comment or an edit came back signed.
   *
   * The thread refetches rather than merging the new entry into the page it
   * already holds: a page is a snapshot, not a live view (api-spec.md), and
   * the refetched page is what carries the pending marker the fresh write
   * wears. SHOW THE CONTENT THEY JUST WROTE (jakob 2026-09-15) — a reply lands
   * one level down, behind its parent's collapsed count, so `unfolding` names
   * the branch that has to be standing when the reader gets there.
   */
  const landed = (unfolding: string | null) => {
    backToThread({ place: place.current, unfolding });
    setCommentSigned(true);
    read(unfolding);
  };

  /**
   * THE COMMENT'S ROWS (`_shared.jsx:392` — `[...CARD_MENU, OPINIONS_ROW,
   * LICENSE_ROW]`). Save · Cite in a new post · Opinions on this · License
   * terms, and no Hide: hiding names an actor, and its route is the
   * commenter's profile (jakob 2026-09-12).
   *
   * `Opinions on this` STANDS WHATEVER THE COUNT IS, which is the difference
   * between a menu row and a count line: a row that came and went with a number
   * would make the menu a different menu every time.
   */
  const commentMenuItems = (comment: ThreadComment): MenuItem[] => {
    const rows: MenuItem[] = [
      { label: "Save", onSelect: () => {}, testId: `comment-menu-save-${comment.id}` },
      {
        label: "Cite in a new post",
        onSelect: () => router.push(`/compose?reference=${comment.id}`),
        testId: `comment-menu-cite-${comment.id}`,
      },
      // INBOUND BEFORE OPINIONS (`_shared.jsx:397-413`): it sits between the
      // acts and the license because it is a fact about the ARTIFACT, where
      // the row under it is a fact about people. Like that row it stands
      // whatever the count is — a comment has no count line of its own, so
      // this is the only door to the list, and the only way to meet it empty.
      {
        label: "Cited by",
        onSelect: () => openCitedBy(comment.id),
        testId: `comment-menu-cited-by-${comment.id}`,
      },
      {
        label: "Opinions on this",
        onSelect: () => {},
        testId: `comment-menu-opinions-${comment.id}`,
      },
    ];
    if (comment.license !== null && comment.license !== undefined) {
      rows.push({
        label: "License terms",
        // Raised from inside the comments thread — a sheet over a sheet
        // (`CommentLicense.jsx`, design/readme.md:2364).
        onSelect: () => openLicense(comment.license),
        testId: `comment-menu-license-${comment.id}`,
      });
    }
    return rows;
  };

  const openEditor = (comment: ThreadComment) => {
    // The editor opens on what the comment actually carries — text and
    // claims alike — so an untouched editor stages nothing (F10). It is
    // the composer's twin surface, so the thread yields to it the same
    // way (see `openComposer`).
    depart();
    const loadedDraft = comment.content.value ?? "";
    const loaded = tagDrafts(comment.topics);
    // A claim CoGra cannot type has no L2 id to name it back by, so it is
    // left out of the section — never staged, never read as a removal.
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
      // The OR is what a READER sees; the switch is the author's own mark
      // and arrives from its own read a moment later (round 4). Starting
      // from the OR would show a moderator's verdict as the author's until
      // it landed, so the switch starts unmarked and the read turns it on.
      loadedSensitive: false,
      loadedSensitiveReason: "",
      sensitive: false,
      sensitiveReason: "",
    });
    void fetchCommentSelfMark(client, comment.id).then((outcome) => {
      if (outcome.kind !== "success") return;
      const mark = outcome.value;
      if (mark === null) return;
      // The read lands as BOTH the switch and what it is compared against,
      // so arriving marked is not itself a change the editor offers to sign.
      setEditing((current) =>
        current === null || current.id !== comment.id
          ? current
          : {
              ...current,
              loadedSensitive: mark.sensitive,
              loadedSensitiveReason: mark.reason,
              sensitive: mark.sensitive,
              sensitiveReason: mark.reason,
            },
      );
    });
    setEditTagErrors({});
    setEditReferenceErrors({});
    setEditRefusedMessage(null);
    setEditFailed(false);
    setEditSensitiveOpen(false);
    setReplying(null);
  };

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
        // The card names itself to the return: it is the anchor the reader's
        // place is measured against when the composer hands the screen back
        // (`scroll-pin.ts`).
        {...{ [ANCHOR_ATTRIBUTE]: comment.id }}
        className="flex flex-col gap-3"
        style={{ marginLeft: `${Math.min(depth, MAX_INDENT_DEPTH) * 12}px` }}
      >
        <Card>
          {/* THE HEADER LINE: the author left, the age right — the same shape
              the post card wears (`CommentCard.jsx:149-155`). Both apps read
              `createdAt` for the Edited comparison and drew none of it. */}
          <div className="flex items-center justify-between gap-2">
            {comment.author && (
              <ActorChip
                handle={comment.author.handle}
                displayName={comment.author.displayName.value}
                avatarUrl={comment.author.avatar?.url}
                testId={`comment-author-${comment.id}`}
              />
            )}
            {shortTimestamp(comment.createdAt) !== "" && (
              <time
                dateTime={comment.createdAt}
                data-testid={`comment-${comment.id}-timestamp`}
                className="flex-none text-body-small text-on-surface-variant"
              >
                {shortTimestamp(comment.createdAt)}
              </time>
            )}
            {/* A COMMENT WEARS THE SAME OVERFLOW A POST DOES (`CommentMenu.jsx`),
                pointed at the comment — beside the age, where the master draws
                it. NO HIDE ROW, and the absence is ruled (jakob 2026-09-12):
                hiding is an act on an ACTOR, and the route to it is the
                commenter's own profile, one tap away through their chip.
                IT IS DRAWN STACKED ON PURPOSE (`CommentMenu.jsx:18-23`): the
                thread already lives in a sheet, so this menu is a sheet on a
                sheet (design/readme.md:2364). */}
            <OverflowMenu
              items={commentMenuItems(comment)}
              ariaLabel="More on this comment"
              testId={`comment-menu-${comment.id}`}
              stacked
            />
          </div>
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
            {/* A COMMENT IS WORDS FIRST and its pictures join them: below the
                words, INSET at the card's medium rung rather than full-bleed
                (they are an attachment, not the body), and capped at comment
                scale so a comment never turns into a post. Comment pictures
                never crop, and every attachment — one or several, picture or
                clip alike — shares the one fixed square frame, filled rather
                than letterboxed (design/readme.md §"the media slice"). */}
            {hasMedia(comment) && (
              <PostMedia
                node={comment}
                bleed="none"
                radius="var(--radius-medium)"
                // SQUARE IS THE COMMENT SCALE'S SHAPE (design/readme.md §"the
                // media slice"): every attachment, picture or clip, alike —
                // not only a video or a multi-picture set — takes the one
                // frame, so a thread's rhythm never changes per comment.
                ratio={1}
                // ...AND FILLED, NEVER LETTERBOXED: an uncropped picture
                // display-crops to the frame rather than fitting whole inside
                // it, same as the video's own centre-crop.
                fit="cover"
                maxHeight="220px"
                // One control, the sound; no transport bar and no duration
                // pill on a surface meant for reading.
                surface="reading"
                testId={`comment-media-${comment.id}`}
              />
            )}
          </BodyRegion>
          {/* The soft marker, friendly not forensic (design.md §9). */}
          {edited && (
            <p
              data-testid={`comment-edited-${comment.id}`}
              className="text-label-small text-on-surface-variant"
            >
              Edited
            </p>
          )}
          {/* Its sibling in the same register: an unlanded comment — or one
              carrying an unlanded edit — is still real. It is what the reader
              meets on the way back from the composer, on the branch the return
              unfolds for them. */}
          {isPending(comment) && <PendingMarker testId={`comment-pending-${comment.id}`} />}
          {/* THE SAME ONE LINE A POST WEARS (`CommentCard.jsx:163-165`): two
              chips then the counts, never two wrapping rows. The full set —
              and the values a reader can ask for — live in the
              topics-and-references sheet, which is not drawn here yet. */}
          <TopicsLine
            topics={comment.topics.map((claim) => ({
              name: claim.hashtag.name.value ?? "",
              pending: claim.pending,
            }))}
            references={comment.references.length}
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
                  // ReplyEntry via=5: the composer, PRE-TARGETED at this
                  // comment. The other door — "Add a comment" at the foot of
                  // the thread — pins the post instead.
                  openComposer(commentTarget(comment));
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
                onClick={() => openEditor(comment)}
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

  return (
    <>
      {/* THE THREAD IS A SHEET OVER WHATEVER RAISED IT (`_shared.jsx:1247-1257`):
          the title, the list of comments, and the entry row pinned at its foot.
          The surface underneath keeps its place — the sheet is a drawer over
          the page, so nothing there scrolls when it opens or drops. */}
      <BottomSheet
        open={open}
        onClose={() => onOpenChange(false)}
        title="Comments"
        height="full"
        bodyRef={bodyRef}
        testId="comments-sheet"
        foot={
          <>
            {/* A completed action is confirmed by a SNACKBAR on both platforms
                (design.md §6). It rides the sheet the way a stance control's
                rides its own card: the thread is what the comment landed in,
                and a snackbar on the page under an open sheet would be behind
                it. */}
            <Snackbar
              testId="comment-signed"
              message={commentSigned ? "Signed — it's in the thread now, still settling." : null}
              onDismiss={dismissCommentSigned}
            />
            {/* ReplyEntry's entry row, pinned at the foot of the sheet: the
                door that pins the POST as what the comment answers. The board
                draws the viewer's own avatar beside it; drawing one here would
                mean a profile read this surface does not otherwise make, which
                is exactly the cost the read restructure is removing, so the row
                is the field alone. */}
            {phase === "signedIn" && (
              <div
                data-testid="comment-entry"
                className="flex items-center gap-3 border-t border-outline-variant px-4 pt-3"
              >
                <button
                  type="button"
                  data-testid="comment-add"
                  onClick={() => openComposer(postTarget(post))}
                  className="cg-state cg-focus min-h-14 flex-1 rounded-extra-small border border-outline px-3 text-left text-body-large text-on-surface-variant"
                >
                  Add a comment
                </button>
              </div>
            )}
            {/* The write affordance swaps, never merely disables: a member gets
                the composer's door, an anonymous reader gets the join entry. */}
            {phase === "signedOut" && (
              <Link
                href="/login"
                data-testid="comment-signin"
                className="block border-t border-outline-variant px-4 pt-3 text-body-medium text-on-surface-variant underline"
              >
                Sign in or join to comment
              </Link>
            )}
          </>
        }
      >
        {/* The list's own gutter is 16px, not the sheet's 24
            (`_shared.jsx:1251`): comment cards stand wider in the sheet than
            rows of text would. */}
        <div className="-mx-2 flex flex-col gap-3">
          {/* The thread's own first read, inside the thread — the surface
              underneath is already drawn and is not waiting on this. */}
          {loading && (
            <p role="status" aria-live="polite" data-testid="comments-loading">
              Loading…
            </p>
          )}
          {/* A failed thread read reads where the thread is, which is here. */}
          {transportFault === "refresh" && (
            <div className="flex items-center gap-3">
              <TransportError testId="comments-transport-error" />
              <Button
                testId="comments-retry"
                variant="outline"
                size="sm"
                onClick={() => read()}
              >
                Retry
              </Button>
            </div>
          )}
          {!loading && transportFault !== "refresh" && comments.length === 0 && (
            <p data-testid="post-no-comments">No comments yet.</p>
          )}
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
        </div>
      </BottomSheet>
      {/* ONE LICENSE SHEET FOR THE THREAD, raised by whichever comment's menu
          row asked. The terms of a node read the same whichever menu asked for
          them (`PostLicense.jsx:7-9`), and raised from in here it is always a
          sheet over a sheet (`CommentLicense.jsx`, design/readme.md:2364). */}
      {licenseShown !== null && (
        <LicenseSheet
          open={licenseOpen}
          onClose={() => setLicenseOpen(false)}
          license={licenseShown}
          testId="license-sheet"
          stacked
        />
      )}
      {/* The comment's ⋮ row, over the thread — stacked for the same reason. */}
      {citedByNode !== null && (
        <CitedBySheet
          open
          onClose={() => setCitedByNode(null)}
          records={citedByRecords}
          hasMore={citedByHasMore}
          loadingMore={citedByLoadingMore}
          onLoadMore={() => void onLoadMoreCitedBy()}
          stacked
          testId="cited-by-sheet"
        />
      )}
      {/* The wizard is a surface OVER the thread, and every way out of it
          comes back here — which is why the thread keeps its page, its
          unfolded branches, and the reader's own place while it is open. */}
      {replying !== null && (
        <ReplyWizard
          target={replying}
          store={store}
          onLeave={() => backToThread({ place: place.current, unfolding: null })}
          onSigned={() => {
            // `ReplySeal` 9 → the thread, the comment settling: the sheet comes
            // back up behind the confirmation. A reply hangs under the comment
            // it answered, so that is the branch the return unfolds; a comment
            // on the post itself is already at the top level.
            landed(replying.kind === "comment" ? replying.id : null);
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
            sensitive={editing.sensitive}
            sensitiveReason={editing.sensitiveReason}
            sensitiveOpen={editSensitiveOpen}
            acts={editActions}
            actsOpen={editActsOpen}
            busy={editSubmitting}
            blocked={editGateReason}
            refusal={editRefusedMessage}
            failed={editFailed}
            onWords={(draft) => setEditing({ ...editing, draft })}
            onSensitive={(sensitive) => setEditing({ ...editing, sensitive })}
            onSensitiveReason={(sensitiveReason) => setEditing({ ...editing, sensitiveReason })}
            onSensitiveOpen={setEditSensitiveOpen}
            onSensitiveHelp={() => setEditHelp(HELP_TOPICS.markingAsSensitive)}
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
            onHelp={() => setEditHelp(HELP_TOPICS.editing)}
            onSign={() => void onSubmitEdit()}
            onLeave={() => backToThread({ place: place.current, unfolding: null })}
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
            testId="comment-edit-describe-sheet"
          />
          <HelpDialog
            open={editHelp !== null}
            onClose={() => setEditHelp(null)}
            topic={editHelp ?? HELP_TOPICS.editing}
            testId="comment-edit-help-dialog"
          />
        </>
      )}
      {confirming !== null && (
        <MultiActionConfirm
          count={editActions}
          busy={editSubmitting}
          testIdPrefix="comment-edit"
          onCancel={() => setConfirming(null)}
          onConfirm={(stopAsking) => {
            if (stopAsking) setConfirmMultiAction(false);
            setConfirming(null);
            void runEdit();
          }}
        />
      )}
    </>
  );
}
