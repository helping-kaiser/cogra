"use client";

// One post, and the door to its thread (comment.md §2).
//
// THE THREAD IS NOT PART OF THIS PAGE. It is the comments sheet — the one
// comments surface, raised here by the card's count exactly as it is raised by
// a feed card's (`app/comments/comments-sheet.tsx`, jakob 2026-09-15). This
// page says which post and whether the sheet is up; everything the thread is,
// composers included, lives in the sheet.
//
// So what is left here is the post: its card, its media, its own menu and the
// sheets that menu raises, and the read behind all of it.

import { useCallback, useEffect, useReducer, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchPostDetail, readCachedPost, type PostView as Post } from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import {
  fetchCitedBy,
  fetchCitedByCount,
  type CitingRecordView,
} from "@/lib/api/references-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { Button } from "@/lib/ui/button";
import { PageHeader } from "@/lib/ui/page-header";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { useScrollHost } from "@/lib/ui/scroll-host";
import {
  BodyRegion,
  bodyIsSensitive,
  galleryItems,
  hasVideo,
  payloadIsRedacted,
  sensitiveSignature,
} from "@/lib/ui/post-media";
import { MediaViewer } from "@/lib/ui2/media/media-viewer";
import { DetailClip } from "@/lib/ui2/media/detail-clip";
import { PostCard } from "@/lib/ui/post-card";
import { LINK_COPIED } from "@/lib/ui/share";
import { CitedBySheet } from "@/lib/ui2/cited-by-sheet";
import { OverflowTrigger } from "@/lib/ui2/overflow-menu";
import { PostMenuHost } from "@/lib/ui2/post-menu-host";
import { CommentsSheet } from "@/app/comments/comments-sheet";
import { useHostSnack } from "@/lib/saved/save-row";
import { Snackbar } from "@/lib/ui/snackbar";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

import { freezeReducer, type Freeze } from "./detail-freeze";
import { NewerVersionLine } from "./newer-version-line";

export function PostView({
  postId,
  store = identityStore,
  from = null,
  landOn = null,
}: {
  postId: string;
  /** Test injection. */
  store?: IdentityStore;
  /** The surface the reader came from, which the back arrow names (`saved`). */
  from?: string | null;
  /**
   * A comment to land on: the thread opens over the post, scrolled to it
   * (jakob 2026-10-01; Saved.md "tap a comment's row").
   */
  landOn?: string | null;
}) {
  // THE BACK ARROW NAMES WHERE THE READER CAME FROM (the origin-naming table):
  // a Saved row's destination reads `Back to Saved`.
  const back = from === "saved" ? { href: "/saved", label: "Back to Saved" } : { href: "/feed", label: "Back to feed" };
  const client = useApolloClient();
  const host = useScrollHost();

  // THE POST THE READER JUST TAPPED PAINTS AT ONCE (jakob 2026-10-09): the
  // feed already holds it, so the page opens on that card rather than on
  // "Loading…", and the detail read below catches up behind it. Only a post
  // the cache does not hold whole — a deep link, a cold start — waits on the
  // read.
  //
  // What the page draws is the card's shape and nothing more: the thread is
  // the sheet's own read, and the author's own mark is the editor's. So the
  // cached card is not a stand-in for something bigger — it is everything
  // this page shows, one read early.
  //
  // AND IT HOLDS (jakob 2026-10-09, seam 120; PostDetail.md:5-15): a read that
  // brings another version of the post does not land over the one opened.
  // `newer` is that version, waiting behind the line until the reader asks for
  // it — every case of how an answer lands is `detail-freeze.ts`'s.
  const [{ post, newer }, land] = useReducer(
    freezeReducer<Post>,
    client,
    (apollo): Freeze<Post> => ({ post: readCachedPost(apollo, postId), newer: null }),
  );
  const [loading, setLoading] = useState(post === null);
  // The read in flight while the post is already on screen — distinct
  // from `loading`, which gates the nothing-loaded page. A pull-to-
  // refresh must not fall back to that blank page over content the
  // reader can already see (HT-10's shared rule).
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [transportFault, setTransportFault] = useState<TransportFault | null>(null);

  // THE THREAD IS A SHEET (`_shared.jsx:1247-1257`), raised by the affordance
  // row's comment count and dropped like any other drawer. The post keeps its
  // place underneath: nothing about the page scrolls when the sheet opens.
  // A Saved comment row opens the post with its thread already up.
  const [commentsOpen, setCommentsOpen] = useState(landOn !== null);
  // THE PAGE'S ONE SNACKBAR (`postDetail.snackbar`): a copied link, and the
  // aftermath of what the post's menu did — `Removed from Saved.` with its
  // `Undo` on `postDetail.snackbar.action` among them.
  const { snack, notify, dismiss: dismissSnack } = useHostSnack();
  // THE POST'S MENU, hosted by the page (`PostMenuHost`): the same sheet the
  // feed hosts, raised here by the header's ⋮. What its rows raise — the
  // license terms, the report's confirm — rises over this page.
  const [menuOpen, setMenuOpen] = useState(false);
  // THE FULLSCREEN VIEWER, over one of this post's attachments (DV-01/H-25).
  // Null is closed; the number is which attachment it opened on. Held here
  // rather than in the card, because "it never changes the underlying route"
  // (`MediaViewer.jsx:26-27`) — the viewer is a layer over this page, so the
  // page is what owns whether it is up.
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  // The post's own inbound list, raised by its count line — over the page,
  // never over the thread, so it never stacks.
  const [citedByOpen, setCitedByOpen] = useState(false);
  const [citedByRecords, setCitedByRecords] = useState<readonly CitingRecordView[]>([]);
  const [citedByCursor, setCitedByCursor] = useState<string | null>(null);
  const [citedByHasMore, setCitedByHasMore] = useState(false);
  const [citedByLoadingMore, setCitedByLoadingMore] = useState(false);
  // The post's own inbound count, for the line that draws only above zero.
  const [citedByCount, setCitedByCount] = useState(0);

  // `asked`: the reader's own pull — the one read that brings the newest in
  // over the opened version rather than holding it behind the line.
  //
  // A pull made while the opening read is still out cannot land an older
  // answer second: the two are the same operation with the same variables,
  // and Apollo Client deduplicates identical queries in flight
  // (`queryDeduplication`, on by default), so both settle on one answer.
  const refresh = useCallback((asked = false) => {
    let cancelled = false;
    void fetchPostDetail(client, postId).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      setRefreshing(false);
      // Over a cached paint a failed read is a failed refresh — the card stays
      // and the banner says so (HT-10's shared rule); with nothing painted it
      // is the nothing-loaded page, as it always was.
      if (outcome.kind !== "success") {
        setTransportFault("refresh");
      } else if (outcome.value === null) {
        setTransportFault(null);
        setNotFound(true);
      } else {
        setTransportFault(null);
        land({ kind: "read", fresh: outcome.value.post, asked });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, postId]);

  useEffect(() => refresh(), [refresh]);

  // The count rides its own read: it is not a field of the post, and it is one
  // aggregate rather than a page, so it costs nothing to ask for separately and
  // keeps the detail read's own budget where it is. A failure leaves the count
  // at zero, which draws no line — an inbound count is not worth a fault banner
  // over the post the reader came for.
  useEffect(() => {
    let cancelled = false;
    void fetchCitedByCount(client, postId).then((outcome) => {
      if (cancelled || outcome.kind !== "success") return;
      setCitedByCount(outcome.value);
    });
    return () => {
      cancelled = true;
    };
  }, [client, postId]);

  const openCitedBy = () => {
    setCitedByOpen(true);
    setCitedByRecords([]);
    setCitedByCursor(null);
    setCitedByHasMore(false);
    void fetchCitedBy(client, postId).then((outcome) => {
      if (outcome.kind !== "success") return;
      setCitedByRecords(outcome.value.items);
      setCitedByCursor(outcome.value.endCursor);
      setCitedByHasMore(outcome.value.hasNextPage);
    });
  };

  const onLoadMoreCitedBy = async () => {
    if (citedByLoadingMore || !citedByHasMore) return;
    setCitedByLoadingMore(true);
    const outcome = await fetchCitedBy(client, postId, citedByCursor);
    setCitedByLoadingMore(false);
    if (outcome.kind !== "success") return;
    setCitedByRecords((current) => appendDeduped(current, outcome.value.items));
    setCitedByCursor(outcome.value.endCursor);
    setCitedByHasMore(outcome.value.hasNextPage);
  };

  // Pull-down at the top is one of the surfaces the pull-to-refresh
  // ruling names (design/readme.md, "The pull-down lives on every
  // full-screen scrolling root", ruled 2026-09-10). It goes through
  // the same fetch the first arrival takes, so a fault it raises
  // surfaces in the same place.
  // What the thread last said its length was — the card arrives with the
  // count the post was read with, and a reply landing moves this one.
  const [liveComments, setLiveComments] = useState<number | null>(null);
  const [threadToken, setThreadToken] = useState(0);
  const onPull = useCallback(() => {
    setRefreshing(true);
    setThreadToken((n) => n + 1);
    refresh(true);
  }, [refresh]);
  // The thread is the sheet's own read, so the page's pull has to say so to
  // both owners — and it stands down entirely while the sheet is raised, so
  // one drag is not also a refetch of the page underneath.
  usePullToRefresh({ host, onPull, enabled: !commentsOpen });

  // The header rides every branch — a dead end (not found, transport
  // fault) is exactly where the back arrow matters most.
  //
  // ON A DETAIL SURFACE THE MENU LIVES UP HERE and the card's own dot yields
  // (`_shared.jsx:341-346` — `PostCard` hides it in `detail`): two dots would
  // be two menus for one post. The header carries the ⋮; the page hosts the
  // sheet it raises.
  //
  // THE DETAIL'S HEADER PINS (design/readme.md §4, "Browse collapses, task
  // pins": the post detail is a pinning surface, and "on web, pinned means
  // `position: sticky` — the bar rides the page's edge and never hides"; the
  // clip detail rulings restate it beside the clip that now scrolls under it).
  // The wrapper bleeds through the page's gutter so its ground covers the
  // edge-to-edge clip and card passing beneath, the way `settings-view.tsx`
  // pins its own.
  const header = (menu: boolean) => (
    <div className="sticky top-0 z-10 -mx-6 bg-surface px-6" data-testid="post-header-bar">
      <PageHeader
        inGutter
        backHref={back.href}
        // The feed restores the place the reader left it in; scrolling it to
        // the top would land on top of that restore.
        backScroll={false}
        backLabel={back.label}
        backTestId="post-back"
        node={{ path: "postDetail.header" }}
        action={
          menu ? (
            <OverflowTrigger
              ariaLabel="More on this post"
              testId="post-menu"
              node={{ path: "postDetail.header.menu" }}
              expanded={menuOpen}
              onOpen={() => setMenuOpen(true)}
            />
          ) : undefined
        }
      />
    </div>
  );

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header(false)}
        <p data-testid="post-loading">Loading…</p>
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
  if (post === null) {
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

  // A REMOVED POST HAS NO MENU LEFT — back is the whole header (`Removed.jsx`),
  // and the license rode the payload, so a redacted record has none to show.
  // What survives is the skeleton the card draws: author, timestamp, thread
  // position, and the stance a reader can still take.
  const redacted = payloadIsRedacted(post);
  // THE DETAIL CLIP'S VEIL FACE (jakob 2026-09-24): the body veils as one and
  // revealing moves nothing, so this is the same `sensitive` the card's own
  // `BodyRegion` computes (`PostCard.tsx` — `!redacted && bodyIsSensitive`),
  // read here too so the clip above the card can share its veil.
  const sensitive = !redacted && bodyIsSensitive(post);
  // A VIDEO POST'S DETAIL IS ITS OWN BOARD (`screens/PostDetailVideo.jsx`):
  // the clip leaves the card body and stands above it, wearing the full
  // transport, and the card beneath is the post as it always reads. A post of
  // pictures is unchanged — its gallery is still the card's body.
  // A REMOVED RECORD HAS NO CLIP TO RAISE: redaction is record-granular, so
  // the skeleton is the whole card and the placeholder is its body.
  const clip = !redacted && hasVideo(post)
    ? galleryItems(post).find((item) => item.mimeType.startsWith("video/"))
    : undefined;
  // A gallery entry's `src` is optional on the tile because the tile also
  // draws the asset-less reserved region; a DETAIL clip is a clip, so a
  // sourceless one is not one and the card keeps its body.
  const detailClip = clip?.src ? { ...clip, src: clip.src } : undefined;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      {/* A REMOVED POST HAS NO MENU LEFT — back is the whole header
          (`Removed.jsx:5-6`). There is nothing of it to edit, cite or license,
          and the skeleton that holds the thread's place is not a thing a reader
          keeps. */}
      {header(!redacted)}
      {refreshing && (
        <p role="status" aria-live="polite" data-testid="post-refreshing">
          Loading…
        </p>
      )}
      {/* A failed whole-post refresh, where the failed read was asked for —
          the page, not the thread, which is a sheet the reader may never open.
          A failed thread read surfaces inside that sheet instead (web.md
          "Design guidelines", the Android twin). */}
      {transportFault === "refresh" && <TransportError testId="post-thread-transport-error" />}
      {/* THE POST IS A CARD HERE TOO (`PostCard.jsx:363` — `<Card>` for every
          variant, `detail` included). It was the page ground while its own
          comments sat on cards, which is the inverse of the board's emphasis.
          Edge to edge inside the page's gutter, so the card and the feed's
          cards frame their media identically (design/backlog.md item 35). */}
      {/* THE CLIP HEADS THE COLUMN, FLUSH ON THE CARD (ruling 100,
          `PostDetailVideo.jsx:30-33`, `DetailClip.prompt.md:15` — "set the
          clip flush on the card — one block, no gap between them"): the two
          share one wrapper, so the page's stack gap falls above the block
          and never between its halves. Edge to edge like the card's own
          media, and in the page's flow — it scrolls with the page
          (PostDetailVideo.md:5). */}
      <div className="-mx-6 flex flex-col">
        {/* BETWEEN THE HEADER AND THE POST (PostDetail.md:7; PostDetailVideo.md
            :65 — "under the header", so above a video post's clip too): the
            line that says a fresh read found another version, and whose tap
            brings it in. In this block for its full width, and because an
            empty live region here takes no page gap. */}
        <NewerVersionLine
          shown={newer !== null}
          onSwap={() => land({ kind: "swap" })}
          node={{ path: "postDetail.newerVersion" }}
        />
        {/* THE DETAIL CLIP'S VEIL FACE (jakob 2026-09-24): a sensitive post's
            clip veils IN PLACE, not demoted into the card, and ONE scope spans
            both — `BodyRegion` keys the reveal on the post's own id and
            sensitive signature, the same key the card's `BodyRegion` reads
            (`PostCard.tsx`), so the shared store in `reveal.ts` answers for
            both from one tap. */}
        {detailClip && (
          <BodyRegion
            veiled={sensitive}
            nodeId={post.id}
            signature={sensitiveSignature(post)}
            testId="post-detail-clip"
          >
            <DetailClip
              src={detailClip.src}
              mimeType={detailClip.mimeType}
              poster={detailClip.poster}
              altText={detailClip.altText}
              sourceRatio={detailClip.sourceRatio}
              durationMs={detailClip.durationMs}
              mediaId={detailClip.mediaId}
              // The viewer is a layer presenting this same clip bigger: while
              // it is up the detail clip has handed its clip over to it
              // (PostDetailVideo.md:57–61).
              behindViewer={viewerAt !== null}
              // The clip's two routes into the viewer — the bar's fullscreen
              // toggle and the clip's own tap (graph.json, `PostDetailVideo`
              // via 19 and via 3; PostDetailVideo.md:35/37). The clip is the
              // post's one attachment, so the viewer opens on it.
              onOpenViewer={() => setViewerAt(0)}
              testId="post-detail-clip"
            />
          </BodyRegion>
        )}
        <PostCard
          post={post}
          variant="detail"
          mediaAbove={detailClip !== undefined}
          // THE POST'S TAP OPENS THE FRAME (graph.json, `PostDetail` via 4 —
          // "detail media → the frame, whole and full-screen"). The feed card's
          // tap opens the post instead, which is why only this variant is
          // handed the route.
          onOpenMedia={(at) => setViewerAt(at)}
          href={`/posts/${postId}`}
          // The registered PostDetail screen's card, keyed by the post's id
          // (`design/designs/canonical/nodes.json`).
          node={{ path: "postDetail.card", key: post.id }}
          testId="post"
          authorTestId="post-author"
          stanceTestId="post-stance"
          // THE THREAD IS NOT HELD (the freeze governs the post, and the
          // thread is the sheet's own read): its size is the freshest read's,
          // the held version's while one waits behind the line.
          comments={liveComments ?? (newer ?? post).comments.totalCount}
          // THE COUNT RAISES THE THREAD (graph.json: every `comment count`
          // edge advances to `ReplyEntry`), here as on every other board that
          // carries it.
          onOpenComments={() => setCommentsOpen(true)}
          onLinkCopied={() => notify(LINK_COPIED)}
          citedBy={citedByCount}
          onOpenCitedBy={openCitedBy}
        />
      </div>
      {/* THE ONE COMMENTS SURFACE, raised over this page by the card's count.
          It owns its own read, its expansions and both composers, so the same
          thread stands whether it was raised from here or from a feed card. */}
      <CommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        post={post}
        store={store}
        onCount={setLiveComments}
        refreshToken={threadToken}
        landOn={landOn}
      />
      {/* THE POST'S MENU AND WHAT ITS ROWS RAISE, over this page
          (ReaderPostMenu, ReportConfirm). A removed post has no menu left, so
          nothing raises it. */}
      <PostMenuHost
        post={redacted ? null : post}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        nodes={{
          sheet: { path: "postDetail.menuSheet" },
          row: (row) => ({ path: `postDetail.menuSheet.${row}` }),
          reportSheet: { path: "postDetail.reportSheet" },
        }}
        testId="post-menu"
        notify={notify}
      />
      {/* The post's own count line. A comment's ⋮ raises the thread's own
          copy, stacked over the sheet, which is the sheet's to mount. */}
      {citedByOpen && (
        <CitedBySheet
          open
          onClose={() => setCitedByOpen(false)}
          records={citedByRecords}
          hasMore={citedByHasMore}
          loadingMore={citedByLoadingMore}
          onLoadMore={() => void onLoadMoreCitedBy()}
          testId="cited-by-sheet"
        />
      )}
      {/* Where the browser has no platform share sheet the control copies the
          link, and this is what says so (readme §13, the audit answers); the
          menu's aftermath lands here too. */}
      <Snackbar
        testId="post-snackbar"
        node={{ path: "postDetail.snackbar" }}
        message={snack?.message ?? null}
        action={snack?.action}
        token={snack?.token}
        onDismiss={dismissSnack}
      />
      {/* THE VIEWER, over everything and answering to nothing behind it. Last
          in the tree because it covers the screen: the layer drawn last is the
          layer on top, and it takes no part in the page's own layout. */}
      {viewerAt !== null && (
        <MediaViewer
          items={galleryItems(post)}
          index={viewerAt}
          onClose={() => setViewerAt(null)}
          testId="post-media-viewer"
        />
      )}
    </main>
  );
}
