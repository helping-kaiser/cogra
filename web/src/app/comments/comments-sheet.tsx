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
// which branch has to be standing when they get back — and it is a property of
// THIS surface, so it reads the same raised from the feed as from the detail.
// Both composers take it: a reply and an edit alike put what was just written
// in front of its author (jakob 2026-09-15, Q6).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import {
  fetchCommentChain,
  fetchCommentReplies,
  fetchPostComments,
  isPending,
  type CommentView,
  type PostView,
  type ReplyView,
} from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import { fetchHeldOpinions, type HeldOpinionView } from "@/lib/api/opinions-api";
import { fetchCitingArtifacts, type CitingArtifactView } from "@/lib/api/references-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { ActorChip } from "@/lib/ui/actor-chip";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import type { DataNode } from "@/lib/ui/data-node";
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
  payloadIsRedacted,
  removalReason,
  removalWhen,
  sensitiveSignature,
} from "@/lib/ui/post-media";
import { withRemoval, type Removal } from "@/lib/api/removal-api";
import { REMOVED_COMMENT_NOTE, RemovedPlaceholder } from "@/lib/ui2/media/removed-placeholder";
import { RemoveConfirm } from "@/lib/ui2/remove-confirm";
import { shortTimestamp } from "@/lib/ui/timestamp";
import { TopicsLine } from "@/lib/ui/topics-line";
import type { ReplyTarget } from "@/lib/compose/reply-wizard";
import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { CitedBySheet } from "@/lib/ui2/cited-by-sheet";
import { OpinionsSheet } from "@/lib/ui2/opinions-sheet";
import { LicenseSheet } from "@/lib/ui2/license-sheet";
import { OverflowMenu, type MenuItem } from "@/lib/ui2/overflow-menu";
import { StageHost } from "@/lib/ui2/media/stage-host";
import { commentTarget, ReplyWizard } from "@/app/posts/[id]/reply/reply-wizard-view";
import { CommentEditor } from "@/app/posts/[id]/edit/comment-editor";
import { StanceControl } from "@/lib/ui/stance-control";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { RowLine } from "@/lib/ui/row-line";
import { useSavedWrites } from "@/lib/saved/provider";
import { useHostSnack } from "@/lib/saved/save-row";
import { commentMenuItems } from "@/lib/ui2/comment-menu";
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

/**
 * The comment's stacked terms sheet: `CommentLicense` registers under
 * `postDetail`, over the thread (design/readme.md round 10), whichever
 * surface raised the thread.
 */
const COMMENT_LICENSE_SHEET: DataNode = { path: "postDetail.licenseSheet" };

/** How many pages a landing reads, of the thread or of one branch, before it settles. */
const LANDING_PAGES = 10;

/** A reader who has not scrolled the thread is at its top. */
const TOP: ScrollPlace = { offset: 0, anchorId: null, anchorTop: 0 };

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

/**
 * What the sheet has to be given back when a composer hands the screen over.
 *
 * TWO VALUES, because one cannot restore the return. The place is where the
 * reader was reading; `unfolding` names the comment whose branch has to be
 * open for the new words to be on screen — the parent a reply hangs under, or
 * the parent of an edited reply — since a branch is behind a collapsed count
 * until it is asked for, and a refetch alone would land the reader on a thread
 * that looks unchanged. Null is content at the top level, already in view.
 */
type Return = { place: ScrollPlace; unfolding: string | null };

export function CommentsSheet({
  open,
  onOpenChange,
  post,
  store = identityStore,
  onCount,
  refreshToken = 0,
  landOn = null,
  aimReply = false,
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
  /**
   * THE COUNT THE CARD SHOWS IS THIS THREAD'S LENGTH. The card reads it with
   * the post and the thread is read here, so a reply that landed moved one
   * number and not the other: the reply appeared and the count above it did
   * not. Every read hands the thread's own total back, and the surface shows
   * that instead of the one it arrived with.
   */
  onCount?: (total: number) => void;
  /**
   * The surface's own re-pull. A thread binds once per post — which is what
   * keeps unfolded branches across a trip to the composer — so without this a
   * reader who pulled the page to refresh still raised the thread as it stood
   * before the pull.
   */
  refreshToken?: number;
  /**
   * A comment to land on (Saved.md "tap a comment's row"): once the thread is
   * read, it pages and unfolds until that comment stands, then scrolls to it.
   */
  landOn?: string | null;
  /**
   * The landing came from a comment card's comment glyph (FeedKinds.md): once
   * the comment stands, the reply composer opens aimed at it.
   */
  aimReply?: boolean;
}) {
  const client = useApolloClient();
  const router = useRouter();
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
  const { snack: menuSnack, notify, dismiss: dismissMenuSnack } = useHostSnack();
  const writes = useSavedWrites();
  // A guest's Save is asked to join first (GuestGate.md:5).
  const [joinOpen, setJoinOpen] = useState(false);
  // THE LICENSE IS NEVER A STATE OF THE CARD (`ReaderPostMenu.jsx:27-29`): one
  // sheet for the thread, raised by whichever comment's menu row asked for it.
  // The license it shows outlives the `open` flag so the block does not blank
  // out mid-exit. Raised from inside the thread it is always a sheet over a
  // sheet, `stacked` (design/readme.md:2364) — the post's own row raises the
  // page's copy instead, which is not this one.
  const [licenseShown, setLicenseShown] = useState<License | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  // The comment's ⋮ row, same rule: over the thread, so always stacked.
  // Which comment's list is up, and its rows once the read lands (null while
  // it is out, so the empty line never shows before the answer does).
  const [citedBy, setCitedBy] = useState<{
    readonly node: string;
    readonly artifacts: readonly CitingArtifactView[] | null;
  } | null>(null);
  // The comment's other ⋮ door, `Opinions on this` (CommentOpinionsEmpty.md):
  // the same sheet the post's line raises, titled for a comment, stacked.
  const [opinionsOn, setOpinionsOn] = useState<{
    readonly node: string;
    readonly opinions: readonly HeldOpinionView[] | null;
  } | null>(null);
  // THE OWN COMMENT'S THINK-TWICE DIALOG (CommentRemoveConfirm), raised by its
  // menu's Remove over the thread, the thread still where the menu was opened.
  const [removing, setRemoving] = useState<ThreadComment | null>(null);
  // Stable, so the snackbar's own timer is not restarted by every render of
  // the thread underneath it.
  const dismissCommentSigned = useCallback(() => setCommentSigned(false), []);

  // Reply threads expanded past their prefetched page, keyed by comment.
  const [replyThreads, setReplyThreads] = useState<Record<string, ReplyThread>>({});
  // The inline comment edit — the affordance renders on own comments only.
  // The editor owns its own state (`CommentEditor`); the thread holds only
  // which comment it is on, and where the return lands (Q6).
  const [editing, setEditing] = useState<{
    comment: ThreadComment;
    /** The comment this one hangs under, or null at the top level. */
    parentId: string | null;
  } | null>(null);

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

  // The latest reporter, held rather than closed over: `read` is what the
  // bind effect depends on, so a caller's inline lambda must not be able to
  // make it a new function and send the thread round again.
  const reportCount = useRef(onCount);
  useEffect(() => {
    reportCount.current = onCount;
  }, [onCount]);

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
        // The thread's own total, up to whatever surface is showing it.
        if (thread) reportCount.current?.(thread.total);
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

  // THE SURFACE'S PULL REACHES THE THREAD. Zero is the token nobody pulled
  // with, so a first composition does not read on top of the bind above.
  const pulled = useRef(refreshToken);
  useEffect(() => {
    if (refreshToken === pulled.current) return;
    pulled.current = refreshToken;
    if (bound.current === post.id) read();
  }, [refreshToken, post.id, read]);

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

  // ---- landing on a comment -----------------------------------------------

  // THE THREAD OPENS LANDED ON THE COMMENT (jakob 2026-10-01; Saved.md). A
  // reply sits behind its parent's collapsed count, and its top-level
  // ancestor may be pages down the thread, so the landing walks the chain up,
  // pages the thread until the top of it arrives, unfolds each branch on the
  // way down, and only then scrolls. Each step is bounded: a chain it cannot
  // finish lands on the deepest comment it could open.
  const landedOn = useRef<string | null>(null);
  const [landingAt, setLandingAt] = useState<string | null>(null);
  // Where the landing came to rest — what an aimed reply opens on.
  const landedAt = useRef<string | null>(null);
  useEffect(() => {
    if (!open || landOn === null || landedOn.current === landOn || loading) return;
    landedOn.current = landOn;
    void (async () => {
      const chain = await fetchCommentChain(client, landOn);
      if (chain.kind !== "success") return;
      const ids = chain.value;
      const top = ids[0]!;
      let items: readonly CommentView[] = [];
      let cursor: string | null = null;
      let more = true;
      for (let page = 0; page < LANDING_PAGES && more && !items.some((c) => c.id === top); page += 1) {
        const next = await fetchPostComments(client, post.id, cursor);
        if (next.kind !== "success" || next.value === null) break;
        items = appendDeduped(items, next.value.items);
        cursor = next.value.endCursor;
        more = next.value.hasNextPage;
      }
      if (items.length > 0) {
        setComments(items);
        setEndCursor(cursor);
        setHasMore(more);
      }
      let deepest = items.some((c) => c.id === top) ? top : null;
      for (let at = 0; deepest !== null && at < ids.length - 1; at += 1) {
        const parent = ids[at]!;
        const child = ids[at + 1]!;
        let replies: readonly ThreadComment[] = [];
        let replyCursor: string | null = null;
        let replyMore = true;
        for (let page = 0; page < LANDING_PAGES && replyMore && !replies.some((r) => r.id === child); page += 1) {
          const next = await fetchCommentReplies(client, parent, replyCursor);
          if (next.kind !== "success") {
            replyMore = false;
            break;
          }
          replies = appendDeduped(replies, next.value.items);
          replyCursor = next.value.endCursor;
          replyMore = next.value.hasNextPage;
        }
        const thread: ReplyThread = {
          items: replies,
          endCursor: replyCursor,
          hasMore: replyMore,
          loading: false,
          failed: false,
        };
        setReplyThreads((current) => ({ ...current, [parent]: thread }));
        deepest = replies.some((r) => r.id === child) ? child : null;
        if (deepest === null) setLandingAt(parent);
      }
      if (deepest !== null) setLandingAt(deepest);
    })();
  }, [open, landOn, loading, client, post.id]);

  // The comment stands once its branch has rendered: scroll it into the
  // sheet's view and hand it focus, so the reader lands where they asked to.
  useMeasureEffect(() => {
    if (landingAt === null) return;
    const scroller = bodyRef.current;
    const target = scroller?.querySelector<HTMLElement>(`[${ANCHOR_ATTRIBUTE}="${landingAt}"]`);
    if (!target) return;
    target.scrollIntoView?.({ block: "center" });
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    landedAt.current = landingAt;
    setLandingAt(null);
  }, [landingAt, comments, replyThreads]);

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
    setCitedBy({ node: nodeId, artifacts: null });
    void fetchCitingArtifacts(client, nodeId).then((outcome) => {
      if (outcome.kind !== "success") return;
      // A later door may have raised another comment's list meanwhile.
      setCitedBy((current) =>
        current?.node === nodeId ? { node: nodeId, artifacts: outcome.value } : current,
      );
    });
  };

  /** The comment's `Opinions on this` row: raised from inside the thread, so it stacks. */
  const openOpinions = (nodeId: string) => {
    setOpinionsOn({ node: nodeId, opinions: null });
    void fetchHeldOpinions(client, nodeId).then((outcome) => {
      if (outcome.kind !== "success") return;
      setOpinionsOn((current) =>
        current?.node === nodeId ? { node: nodeId, opinions: outcome.value } : current,
      );
    });
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

  // A LANDING THAT CAME FROM A COMMENT CARD'S GLYPH (FeedKinds.md, Saved.md)
  // opens the reply composer aimed at the comment it came to rest on — once.
  const aimed = useRef<string | null>(null);
  useMeasureEffect(() => {
    const at = landedAt.current;
    if (!aimReply || at === null || at !== landOn || aimed.current === at) return;
    const landed =
      comments.find((comment) => comment.id === at) ??
      Object.values(replyThreads)
        .flatMap((thread) => thread.items)
        .find((reply) => reply.id === at);
    if (landed === undefined) return;
    aimed.current = at;
    openComposer(commentTarget(landed));
  }, [landingAt, comments, replyThreads]);

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
   * THE COMMENT'S ROWS — the one builder every comment's ⋮ shares
   * (`comment-menu.ts`), its aftermath on this thread's own snackbar. The
   * license terms rise from inside the thread, a sheet over a sheet
   * (`CommentLicense.jsx`, design/readme.md:2364).
   */
  const menuRowsOf = (comment: ThreadComment, own: boolean): MenuItem[] =>
    commentMenuItems({
      comment,
      writes,
      notify,
      onGuest: phase === "signedOut" ? () => setJoinOpen(true) : null,
      navigate: (route) => router.push(route),
      openCitedBy,
      openOpinions,
      openLicense,
      // THE READER'S OWN COMMENT'S MENU (CommentMenuOwn.md:3): Remove joins it.
      openRemove: own ? () => setRemoving(comment) : undefined,
      testIdPrefix: "comment-menu",
    });

  /**
   * A REMOVAL TAKEN IN THE THREAD (CommentRemoveConfirm.md:11): the comment's
   * words and pictures give way to the mark in the comment's own place. Only
   * that node changes — the page, the unfolded branches and the reader's place
   * stay exactly as they stand (CommentRemoved.md:15, :19), which is why the
   * thread swaps the one node for its marked self rather than reading again:
   * a re-read starts every branch over.
   */
  const markRemoved = (id: string, removal: Removal) => {
    const mark = <C extends ThreadComment>(comment: C): C =>
      comment.id === id ? withRemoval(comment, removal) : comment;
    setComments((current) => current.map(mark));
    setReplyThreads((current) =>
      Object.fromEntries(
        Object.entries(current).map(([parent, thread]) => [
          parent,
          { ...thread, items: thread.items.map(mark) },
        ]),
      ),
    );
  };

  const openEditor = (comment: ThreadComment, parentId: string | null) => {
    // The editor opens on what the comment actually carries — text and
    // claims alike — so an untouched editor stages nothing (F10). It is
    // the composer's twin surface, so the thread yields to it the same
    // way (see `openComposer`).
    depart();
    setEditing({ comment, parentId });
    setReplying(null);
  };

  /**
   * `parentId` is the comment this one hangs under — null at the top level. It
   * is what both returns restore: a reply lands under the comment it answers,
   * and an edited reply is behind its own parent's collapsed count, so either
   * way the branch that has to be standing afterwards is named here.
   */
  const renderComment = (
    comment: ThreadComment,
    depth: number,
    parentId: string | null,
  ): React.ReactNode => {
    const thread = replyThreads[comment.id];
    const replies = thread?.items ?? [];
    const repliesHaveMore = thread?.hasMore ?? false;
    // Collapsed until a reader asks: the branch is a count on the wire, and
    // the count is all the line needs to promise.
    const branch = replyCount(comment);
    const unopened = thread === undefined && branch > 0;
    const isOwn = viewerId !== null && comment.author?.id === viewerId;
    const edited = comment.updatedAt > comment.createdAt;
    // A REMOVED COMMENT (CommentRemoved.md): it keeps its author, its time and
    // its place in the order, the mark where its words were; it has no menu
    // left and no Edit — nothing of it is left to save, cite, license or edit —
    // while Reply and the face stay, and its replies stay under it.
    const removed = payloadIsRedacted(comment);
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
            {/* THE AGE AND THE ⋮ STAND TOGETHER at the line's end, 12px apart
                (`CommentCard.jsx`'s header: one `space-3` group), as the post
                card's do — three loose children of a spread line put the age
                in the middle of it. */}
            <div className="flex flex-none items-center gap-3">
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
                  sheet (design/readme.md:2364). A REMOVED COMMENT HAS NO MENU
                  LEFT (`_shared.jsx`, `menuItems={removed ? [] : …}`). */}
              {!removed && (
                <OverflowMenu
                  items={menuRowsOf(comment, isOwn)}
                  ariaLabel="More on this comment"
                  sheetLabel="Comment actions"
                  testId={`comment-menu-${comment.id}`}
                  stacked
                />
              )}
            </div>
          </div>
          {/* THE MARK IN THE WORDS' PLACE (`CommentsThreadSheet removed`): the
              author's mark, its second line naming the comment, dated by the
              removal's own moment. */}
          {removed ? (
            <RemovedPlaceholder
              reason={removalReason(comment)}
              when={removalWhen(comment)}
              note={removalReason(comment) === "author" ? REMOVED_COMMENT_NOTE : undefined}
              testId={`comment-${comment.id}-removed`}
            />
          ) : (
          /* A comment is text PLUS optional media — the XOR is the post's
              rule alone (D16) — so both render, and both are veiled as one
              body when the comment is marked. */
          <BodyRegion
            veiled={bodyIsSensitive(comment)}
            // THE COMMENT-SCALE FACE (CommentCard.jsx `kind="compact"`): one
            // block in the body's place, naming whose mark it is.
            marks={comment}
            face="compact"
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
          )}
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
          {/* The topics and citations rode the payload; a removed comment has
              none left to show (`CommentCard.jsx`, `!redacted`). */}
          {!removed && (
            <TopicsLine
              topics={comment.topics.map((claim) => ({
                name: claim.hashtag.name.value ?? "",
                pending: claim.pending,
              }))}
              references={comment.references.length}
              testIdPrefix={`comment-${comment.id}`}
            />
          )}
          {/* The comment carries its own stance control (design.md §6). */}
          <StanceControl
            target={{ id: comment.id, kind: "comment", label: "this comment" }}
            testIdPrefix={`comment-stance-${comment.id}`}
          />
          {/* THE ROW LINE under the face (RowSigning.md): a save or unsave of
              this comment that did not go through. */}
          {writes.failure(comment.id) !== null && (
            <RowLine
              state={{
                kind: "didntGoThrough",
                onRetry: () => writes.failure(comment.id)?.retry(),
              }}
              testId={`comment-${comment.id}-row-line`}
            />
          )}
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
            {/* The removed comment keeps `own` but loses Edit with its payload
                (`_shared.jsx`: `onEdit={removed ? undefined : …}`). */}
            {isOwn && !removed && (
              <Button
                testId={`comment-edit-${comment.id}`}
                variant="text"
                size="sm"
                onClick={() => openEditor(comment, parentId)}
              >
                Edit
              </Button>
            )}
          </div>
        </Card>
        {replies.length > 0 && (
          <ul className="flex flex-col gap-3">
            {replies.map((reply) => renderComment(reply, depth + 1, comment.id))}
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
        tallest
        bodyRef={bodyRef}
        testId="comments-sheet"
        // THE THREAD HANDS THE SCREEN TO ITS COMPOSER WITHOUT A GAP. The sheet
        // drops as the wizard or the editor rises, and rises again as it
        // leaves; holding the sheet's cover through the takeover is what
        // keeps the surface beneath from reading the moment between as the
        // suspension lifting (`BottomSheet`'s `coverHeld`).
        coverHeld={replying !== null || editing !== null}
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
            {/* THE COMMENT MENUS' AFTERMATH (CommentMenu.md, design digest item
                54): `Saved.`, and `Removed from Saved.` with `Undo`. It reads
                inside the thread, where the menu was opened; the page's own
                `postDetail.snackbar` is beneath the sheet's scrim, so this one
                carries no registered path until a stacked state is drawn. */}
            <Snackbar
              testId="comment-menu-snackbar"
              message={menuSnack?.message ?? null}
              action={menuSnack?.action}
              token={menuSnack?.token}
              onDismiss={dismissMenuSnack}
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
            rows of text would.
            THE THREAD IS ITS OWN STAGE (design/readme.md §13: "a clip drawn
            on the sheet competes for the stage by the same law"), standing
            on the sheet and landing at the sheet body's own hard top
            (ReplyEntry.md:3/5). */}
        <StageHost>
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
              {comments.map((comment) => renderComment(comment, 0, null))}
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
        </StageHost>
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
          testId="postDetail.licenseSheet"
          node={COMMENT_LICENSE_SHEET}
          stacked
        />
      )}
      {/* The comment's ⋮ row, over the thread — stacked for the same reason. */}
      {citedBy !== null && (
        <CitedBySheet
          open
          onClose={() => setCitedBy(null)}
          artifacts={citedBy.artifacts}
          stacked
          testId="cited-by-sheet"
        />
      )}
      {opinionsOn !== null && (
        <OpinionsSheet
          open
          onClose={() => setOpinionsOn(null)}
          on="comment"
          opinions={opinionsOn.opinions}
          stacked
          testId="opinions-sheet"
        />
      )}
      {/* REMOVE THIS COMMENT? — the post's confirm with the nouns swapped
          (`RemoveDialog kind="comment"`), up over the thread: a modal raised
          after the sheet stands above it in the top layer, the way the board
          lifts it (`overSheet`). The thread beneath is untouched, still where
          the menu was opened (CommentRemoveConfirm.md:3). The comment's
          confirm carries the post's fault line too (RM-G7's build word).
          UNREGISTERED: the thread sheet is deliberately unnamed (seam 094), so
          the dialog keeps its test ids. */}
      {removing !== null && (
        <RemoveConfirm
          kind="comment"
          nodeId={removing.id}
          record={removing.genesisRecordId}
          onClose={() => setRemoving(null)}
          onRemoved={(removal) => markRemoved(removing.id, removal)}
          testId="comment-remove-confirm"
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
        <CommentEditor
          key={editing.comment.id}
          comment={editing.comment}
          parentId={editing.parentId}
          postId={post.id}
          targetLabel={post.title.value?.trim() || "this post"}
          onLeave={() => backToThread({ place: place.current, unfolding: null })}
          // The edit settles IN THE THREAD (`CommentEdit` → the thread), so the
          // sheet comes back up with it and the snackbar reads over it.
          //
          // SHOW THEM WHAT THEY JUST WROTE — an edit as much as a reply (jakob
          // 2026-09-15, Q6): an edited reply lives one level down, behind its
          // parent's collapsed count, so the return unfolds that branch the
          // same way the reply path does.
          onSigned={() => landed(editing.parentId)}
        />
      )}
      {joinOpen && <JoinPrompt open onClose={() => setJoinOpen(false)} />}
    </>
  );
}
