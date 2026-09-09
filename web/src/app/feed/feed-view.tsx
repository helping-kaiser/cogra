"use client";

// The chronological listing (roadmap "Slice 2"): every post,
// newest-first in the graph's own landing order — deliberately not the
// ranked feed. Reading needs no session (web.md "Routes"), so the
// surface lives outside the (app) gate; only the write affordance
// swaps on the auth phase.
//
// IT REMEMBERS WHERE THE READER WAS — the pages they had loaded and the
// offset they had reached — in `feed-memory.ts`, which says why an external
// store and not the router. Both are read at mount and applied before the
// first paint, so opening a post and coming back is not a fresh feed.

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchPosts, type PostView } from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthPhase } from "@/lib/session/provider";
import { useRegistrationProgress } from "@/lib/signing/provider";
import { RestoreCard } from "@/app/applicant-status";
import { StatusBanners } from "@/app/status-banners";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { CograBand } from "@/lib/ui/cogra-band";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { PostCard } from "@/lib/ui/post-card";
import { scrollElementOf, useScrollHost } from "@/lib/ui/scroll-host";
import { LINK_COPIED } from "@/lib/ui/share";
import { Snackbar } from "@/lib/ui/snackbar";
import { ComposeNotice, composeOutcomeOf } from "./compose-notice";
import { recallFeed, rememberFeed, rememberFeedOffset } from "./feed-memory";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

function GuestBanner() {
  return (
    <Card testId="feed-guest-banner">
      <p className="text-body-medium text-on-surface-variant">
        You&apos;re browsing as a guest — sign in or join to post and vouch.
      </p>
      {/* Filled: joining is the one committing action a guest has on
          this surface (design.md §6). */}
      <Link
        href="/login"
        data-testid="feed-signin"
        className={buttonClassName({ size: "sm", selfStart: true })}
      >
        Sign in or join
      </Link>
    </Card>
  );
}

export function FeedView({
  store = identityStore,
}: {
  /** Test injection. */
  store?: IdentityStore;
} = {}) {
  const keyOnDevice = useKeyOnDevice(store);
  // A KEY THAT WAS NEVER MADE IS NOT A KEY TO RESTORE. This card used to ask
  // on "no key in this browser" alone, so a just-created account — which has
  // no key anywhere yet — was told to restore one AND offered the ceremony in
  // the applicant stack below it, both at once. The boards keep the two
  // apart: `KeyElsewhere` is for an account whose key exists somewhere else,
  // `KeyCeremony` for one that has none, and no board carries both.
  const progress = useRegistrationProgress();
  const noKeyYet = progress?.kind === "awaitingApproval" && !progress.keyAttached;
  const client = useApolloClient();
  const phase = useAuthPhase();
  const router = useRouter();
  const outcome = composeOutcomeOf(useSearchParams().get("compose"));
  const host = useScrollHost();
  // Read ONCE, at mount: what the feed left behind last time it was on
  // screen. Seeding the state from it is what makes the pages come back
  // synchronously, on the first render, before anything is painted.
  const remembered = useRef(recallFeed()).current;
  const [posts, setPosts] = useState<readonly PostView[]>(remembered?.posts ?? []);
  const [endCursor, setEndCursor] = useState<string | null>(remembered?.endCursor ?? null);
  const [hasNextPage, setHasNextPage] = useState(remembered?.hasNextPage ?? false);
  const [loading, setLoading] = useState(remembered === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transportFault, setTransportFault] = useState<TransportFault | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // Stable, so the snackbar's own timer is not restarted by every render of
  // the feed underneath it.
  const dismissLinkCopied = useCallback(() => setLinkCopied(false), []);

  // Effect-invoked, so no synchronous setState here; the retry button
  // resets the loading state in its own handler. The fault reflects
  // the last COMPLETED fetch — clearing it eagerly at fetch start
  // made the banner vanish and reappear on every failed retry. It
  // also carries which fetch failed, so the fault can surface where
  // that fetch was requested.
  const refresh = useCallback(() => {
    let cancelled = false;
    void fetchPosts(client).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind === "success") {
        setTransportFault(null);
        setPosts(outcome.value.items);
        setEndCursor(outcome.value.endCursor);
        setHasNextPage(outcome.value.hasNextPage);
      } else {
        setTransportFault("refresh");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  // A remembered feed is not re-fetched. A refresh takes no cursor, so it
  // would answer with page one and throw away every page after it — which is
  // the loss this whole file exists to stop. The reader gets new posts from a
  // reload or from Retry, both of which are deliberate.
  useEffect(() => {
    if (remembered !== null) return;
    return refresh();
  }, [refresh, remembered]);

  // The pages, kept for the next mount. Written from an effect rather than
  // from each fetch so no path can set state and forget to record it.
  useEffect(() => {
    if (loading) return;
    rememberFeed({ posts, endCursor, hasNextPage });
  }, [loading, posts, endCursor, hasNextPage]);

  // The place. Restored before the browser paints — the pages are already in
  // this render, so the scroller is as tall now as it was when the reader
  // left, and the offset lands where they were rather than at the end of a
  // shorter list.
  useLayoutEffect(() => {
    const scroller = scrollElementOf(host);
    if (scroller === null || remembered === null) return;
    scroller.scrollTop = remembered.offset;
  }, [host, remembered]);

  // Kept on the way past rather than on unmount: a mobile browser may never
  // run an unmount, and one assignment per frame is cheaper than a render.
  useEffect(() => {
    const scroller = scrollElementOf(host);
    if (scroller === null) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        rememberFeedOffset(scroller.scrollTop);
        ticking = false;
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [host]);

  const onLoadMore = async () => {
    if (loadingMore || !hasNextPage) return;
    setLoadingMore(true);
    const outcome = await fetchPosts(client, endCursor);
    setLoadingMore(false);
    if (outcome.kind === "success") {
      setTransportFault(null);
      setPosts((current) => appendDeduped(current, outcome.value.items));
      setEndCursor(outcome.value.endCursor);
      setHasNextPage(outcome.value.hasNextPage);
    } else {
      setTransportFault("append");
    }
  };

  return (
    // The band is chrome and full-bleed, so the gutter belongs to the content
    // below it rather than to the column that holds both.
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-6">
      <CollapsingTop>
        {/* A tab root wears the mark, not a page title: the reader knows which
            tab they are on from the bar, and the band's other half works. */}
        <CograBand>
          <div className="flex flex-col gap-4 px-6">
            {/* Must-act, so it collapses into the header and follows the
                reader back up instead of living only at the top. */}
            {phase === "signedIn" && keyOnDevice === false && !noKeyYet && <RestoreCard />}
            {/* The signed-out reader's card rides the same slot: the one
                sign-in-or-join entry, in place of a header action. */}
            {phase === "signedOut" && <GuestBanner />}
          </div>
        </CograBand>
      </CollapsingTop>
      <div className="flex flex-col gap-4 px-6">
        {/* The account-status banners ride the active tab (design.md §6). */}
        {phase === "signedIn" && <StatusBanners />}
        {/* What the wizard just did, if anything. Dismissing drops the query
            value, so the notice cannot come back on a reload. */}
        {outcome !== null && <ComposeNotice onDismiss={() => router.replace("/feed")} />}
        {transportFault === "refresh" && (
          <div className="flex items-center gap-3">
            {/* With posts on screen the fault means "stale", not "gone":
                the loaded posts stay readable under this banner. A failed
                page fetch surfaces at the load-more slot instead (web.md
                "Design guidelines", the Android twin). */}
            <TransportError
              testId="feed-transport-error"
              message={
                posts.length > 0
                  ? "Can't reach the server — new posts can't load right now."
                  : undefined
              }
            />
            <Button
              testId="feed-retry"
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
        )}
        {loading && <p data-testid="feed-loading">Loading…</p>}
        {!loading && transportFault === null && posts.length === 0 && (
          <p data-testid="feed-empty">Nothing here yet — write the first post.</p>
        )}
      </div>
      {/* A FEED POST IS A FULL-WIDTH CONTAINER (design/readme.md, "Feed
          containers — rounded full-width cards"): the filled card keeps its
          corners, tone and 16px text inset but spans the screen edge to edge,
          and 8px of surface between cards is the seam. So the list leaves the
          gutter its neighbours keep — the
          board's own `FeedList`, `gap: 8, padding: "8px 0 0 0"`. What the
          42rem column shows above phone width is whatever it shows: desktop is
          out of design scope until the mobile set is complete (readme §2). */}
      <ul className="flex flex-col gap-2" data-testid="feed-list">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              href={`/posts/${post.id}`}
              testId={`feed-post-${post.id}`}
              authorTestId={`feed-author-${post.id}`}
              stanceTestId={`feed-stance-${post.id}`}
              comments={post.comments.totalCount}
              onLinkCopied={() => setLinkCopied(true)}
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-4 px-6">
        {hasNextPage &&
          (transportFault === "append" ? (
            <div className="flex items-center justify-center gap-3">
              <TransportError
                testId="feed-load-more-error"
                message="Can't reach the server — new posts can't load right now."
              />
              <Button
                testId="feed-load-more-retry"
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
              testId="feed-load-more"
              variant="outline"
              onClick={() => void onLoadMore()}
              disabled={loadingMore}
            >
              Load more
            </Button>
          ))}
        {/* One region for the whole feed: a card that copied a link says so
            here rather than each card mounting a live region of its own. */}
        <Snackbar
          testId="feed-link-copied"
          message={linkCopied ? LINK_COPIED : null}
          onDismiss={dismissLinkCopied}
        />
      </div>
    </main>
  );
}
