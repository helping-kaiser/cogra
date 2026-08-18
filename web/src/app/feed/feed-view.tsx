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
import { useAuthPhase } from "@/lib/session/provider";
import { StatusBanners } from "@/app/status-banners";
import { ActorChip } from "@/lib/ui/actor-chip";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

export function FeedView() {
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
      setPosts((current) => [...current, ...outcome.value.items]);
      setEndCursor(outcome.value.endCursor);
      setHasNextPage(outcome.value.hasNextPage);
    } else {
      setTransportFault("append");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <PageHeader
        title="Feed"
        backHref={phase === "signedIn" ? undefined : "/"}
        backLabel="Back to home"
        backTestId="feed-back"
        action={
          phase === "signedOut" ? (
            <Link
              href="/"
              data-testid="feed-signin"
              className={buttonClassName({ variant: "outline", size: "sm" })}
            >
              Sign in or join
            </Link>
          ) : undefined
        }
      />
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
            <Card>
              {post.author && (
                <ActorChip
                  handle={post.author.handle}
                  displayName={post.author.displayName.value}
                  testId={`feed-author-${post.id}`}
                />
              )}
              <Link
                href={`/posts/${post.id}`}
                data-testid={`feed-post-${post.id}`}
                className="flex flex-col gap-1"
              >
                {post.title.value && <h2 className="text-title-medium">{post.title.value}</h2>}
                <p className="line-clamp-4 text-body-medium">{post.content.value}</p>
              </Link>
            </Card>
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
