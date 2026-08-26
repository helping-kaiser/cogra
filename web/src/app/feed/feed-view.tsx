"use client";

// The chronological listing (roadmap "Slice 2"): every post,
// newest-first in the graph's own landing order — deliberately not the
// ranked feed. Reading needs no session (web.md "Routes"), so the
// surface lives outside the (app) gate; only the write affordance
// swaps on the auth phase.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchPosts, type PostView } from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthPhase } from "@/lib/session/provider";
import { RestoreCard } from "@/app/applicant-status";
import { StatusBanners } from "@/app/status-banners";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { PageHeader } from "@/lib/ui/page-header";
import { PostCard } from "@/lib/ui/post-card";
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
  const client = useApolloClient();
  const phase = useAuthPhase();
  const [posts, setPosts] = useState<readonly PostView[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transportFault, setTransportFault] = useState<TransportFault | null>(null);

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

  useEffect(() => refresh(), [refresh]);

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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      <CollapsingTop>
        <PageHeader title="Feed" />
        {/* Must-act, so it collapses into the header and follows the
            reader back up instead of living only at the top. */}
        {phase === "signedIn" && keyOnDevice === false && <RestoreCard />}
        {/* The signed-out reader's card rides the same slot: the one
            sign-in-or-join entry, in place of a header action. */}
        {phase === "signedOut" && <GuestBanner />}
      </CollapsingTop>
      {/* The account-status banners ride the active tab (design.md §6). */}
      {phase === "signedIn" && <StatusBanners />}
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
      <ul className="flex flex-col gap-3" data-testid="feed-list">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} prefix="feed" />
          </li>
        ))}
      </ul>
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
    </main>
  );
}
