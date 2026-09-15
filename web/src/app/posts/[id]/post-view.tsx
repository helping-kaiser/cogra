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

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchPostDetail, type PostDetail } from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import {
  fetchCitedBy,
  fetchCitedByCount,
  type CitingRecordView,
} from "@/lib/api/references-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useActiveAccountId } from "@/lib/session/provider";
import { Button } from "@/lib/ui/button";
import type { License } from "@/lib/license";
import { PageHeader } from "@/lib/ui/page-header";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { galleryItems, hasVideo, payloadIsRedacted } from "@/lib/ui/post-media";
import { MediaViewer } from "@/lib/ui2/media/media-viewer";
import { PinnedClip } from "@/lib/ui2/media/pinned-clip";
import { PostCard } from "@/lib/ui/post-card";
import { LINK_COPIED } from "@/lib/ui/share";
import { CitedBySheet } from "@/lib/ui2/cited-by-sheet";
import { LicenseSheet } from "@/lib/ui2/license-sheet";
import { OverflowMenu, type MenuItem } from "@/lib/ui2/overflow-menu";
import { postMenuItems } from "@/lib/ui2/post-menu";
import { RemoveConfirm } from "@/lib/ui2/remove-confirm";
import { CommentsSheet } from "@/app/comments/comments-sheet";
import { Snackbar } from "@/lib/ui/snackbar";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

export function PostView({
  postId,
  store = identityStore,
}: {
  postId: string;
  /** Test injection. */
  store?: IdentityStore;
}) {
  const client = useApolloClient();
  const router = useRouter();
  const viewerId = useActiveAccountId();
  const host = useScrollHost();

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // THE LICENSE IS NEVER A STATE OF THE CARD (`ReaderPostMenu.jsx:27-29`): one
  // sheet for the page, raised by the post's own menu row. The license it
  // shows outlives the `open` flag so the block does not blank out mid-exit.
  // It is never stacked — the post's menu lives in the page header, over the
  // page; a comment's license is the thread's own sheet to raise.
  const [licenseShown, setLicenseShown] = useState<License | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
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
  const [removeOpen, setRemoveOpen] = useState(false);
  const dismissLinkCopied = useCallback(() => setLinkCopied(false), []);

  const refresh = useCallback(() => {
    let cancelled = false;
    void fetchPostDetail(client, postId).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      setRefreshing(false);
      if (outcome.kind !== "success") {
        setTransportFault("refresh");
      } else if (outcome.value === null) {
        setTransportFault(null);
        setNotFound(true);
      } else {
        setTransportFault(null);
        setDetail(outcome.value);
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
    refresh();
  }, [refresh]);
  // The thread is the sheet's own read, so the page's pull has to say so to
  // both owners — and it stands down entirely while the sheet is raised, so
  // one drag is not also a refetch of the page underneath.
  usePullToRefresh({ host, onPull, enabled: !commentsOpen });

  const openLicense = (license: License) => {
    setLicenseShown(license);
    setLicenseOpen(true);
  };

  /** The shared rows (`ui2/post-menu.ts`), bound to this page's doors. */
  const menuFor = (own: boolean, handle: string | null, license: License | null) =>
    postMenuItems({
      postId,
      own,
      handle,
      license,
      navigate: (href) => router.push(href),
      openLicense,
      openRemove: () => setRemoveOpen(true),
      testIdPrefix: "post-menu",
    });

  // The header rides every branch — a dead end (not found, transport
  // fault) is exactly where the back arrow matters most.
  //
  // ON A DETAIL SURFACE THE MENU LIVES UP HERE and the card's own dot yields
  // (`_shared.jsx:341-346` — `PostCard` hides it in `detail`): two dots would
  // be two menus for one post.
  const header = (menu: readonly MenuItem[] | null) => (
    <PageHeader
      backHref="/feed"
      // The feed restores the place the reader left it in; scrolling it to the
      // top would land on top of that restore.
      backScroll={false}
      backLabel="Back to feed"
      backTestId="post-back"
      action={
        menu === null || menu.length === 0 ? undefined : (
          <OverflowMenu items={menu} ariaLabel="More on this post" testId="post-menu" />
        )
      }
    />
  );

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header(null)}
        <p>Loading…</p>
      </main>
    );
  }
  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header(null)}
        <p role="alert" data-testid="post-not-found">
          This post no longer resolves.
        </p>
      </main>
    );
  }
  if (detail === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header(null)}
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
  const isOwnPost = viewerId !== null && post.author?.id === viewerId;
  // A REMOVED POST HAS NO MENU LEFT — back is the whole header (`Removed.jsx`),
  // and the license rode the payload, so a redacted record has none to show.
  // What survives is the skeleton the card draws: author, timestamp, thread
  // position, and the stance a reader can still take.
  const redacted = payloadIsRedacted(post);
  // A VIDEO POST'S DETAIL IS ITS OWN BOARD (`screens/PostDetailVideo.jsx`):
  // the clip leaves the card body and pins above it, wearing the full
  // transport, and the card beneath is the post as it always reads. A post of
  // pictures is unchanged — its gallery is still the card's body.
  // A REMOVED RECORD HAS NO CLIP TO PIN: redaction is record-granular, so the
  // skeleton is the whole card and the placeholder is its body.
  const clip = !redacted && hasVideo(post)
    ? galleryItems(post).find((item) => item.mimeType.startsWith("video/"))
    : undefined;
  // A gallery entry's `src` is optional on the tile because the tile also
  // draws the asset-less reserved region; a PINNED clip is a clip, so a
  // sourceless one is not one and the card keeps its body.
  const pinned = clip?.src ? { ...clip, src: clip.src } : undefined;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      {/* A REMOVED POST HAS NO MENU LEFT — back is the whole header
          (`Removed.jsx:5-6`). There is nothing of it to edit, cite or license,
          and the skeleton that holds the thread's place is not a thing a reader
          keeps. */}
      {header(
        redacted ? null : menuFor(isOwnPost, post.author?.handle ?? null, post.license),
      )}
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
      {/* THE CLIP PINS ABOVE THE CARD, edge to edge like the card's own media:
          the board stands it outside the detail column entirely
          (`PostDetailVideo.jsx:25-28`). */}
      {pinned && (
        <div className="-mx-6">
          <PinnedClip
            src={pinned.src}
            mimeType={pinned.mimeType}
            poster={pinned.poster}
            altText={pinned.altText}
            sourceRatio={pinned.sourceRatio}
            durationMs={pinned.durationMs}
            // The pinned clip's two routes into the viewer — the bar's
            // fullscreen toggle and the clip's own tap (graph.json,
            // `PostDetailVideo` via 19 and via 3). The clip is the post's one
            // attachment, so the viewer opens on it.
            onOpenViewer={() => setViewerAt(0)}
            testId="post-pinned-clip"
          />
        </div>
      )}
      <div className="-mx-6">
        <PostCard
          post={post}
          variant="detail"
          mediaPinned={pinned !== undefined}
          // THE POST'S TAP OPENS THE FRAME (graph.json, `PostDetail` via 4 —
          // "detail media → the frame, whole and full-screen"). The feed card's
          // tap opens the post instead, which is why only this variant is
          // handed the route.
          onOpenMedia={(at) => setViewerAt(at)}
          href={`/posts/${postId}`}
          testId="post"
          authorTestId="post-author"
          stanceTestId="post-stance"
          comments={liveComments ?? post.comments.totalCount}
          // THE COUNT RAISES THE THREAD (graph.json: every `comment count`
          // edge advances to `ReplyEntry`), here as on every other board that
          // carries it.
          onOpenComments={() => setCommentsOpen(true)}
          onLinkCopied={() => setLinkCopied(true)}
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
      />
      {/* ONE LICENSE SHEET FOR THE PAGE, raised by the post's own menu row. */}
      {licenseShown !== null && (
        <LicenseSheet
          open={licenseOpen}
          onClose={() => setLicenseOpen(false)}
          license={licenseShown}
          testId="license-sheet"
        />
      )}
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
      {/* THE DIALOG SHIPS, THE REMOVAL DOES NOT (jakob 2026-09-14): erasure is
          slice 8's, whole — "we need to do erasure right so it should be one
          task" — so Remove closes the dialog and changes nothing. */}
      <RemoveConfirm
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onRemove={() => setRemoveOpen(false)}
      />
      {/* Where the browser has no platform share sheet the control copies the
          link, and this is what says so (readme §13, the audit answers). */}
      <Snackbar
        testId="post-link-copied"
        message={linkCopied ? LINK_COPIED : null}
        onDismiss={dismissLinkCopied}
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
