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
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";
import { TransportError } from "@/lib/ui/transport-error";

export function FeedView() {
  const client = useApolloClient();
  const phase = useAuthPhase();
  const [posts, setPosts] = useState<readonly PostView[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transportFailed, setTransportFailed] = useState(false);

  // Effect-invoked, so no synchronous setState here; the retry button
  // resets loading/transport state in its own handler.
  const refresh = useCallback(() => {
    let cancelled = false;
    void fetchPosts(client).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind === "success") {
        setPosts(outcome.value.items);
        setEndCursor(outcome.value.endCursor);
        setHasNextPage(outcome.value.hasNextPage);
      } else {
        setTransportFailed(true);
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
      setPosts((current) => [...current, ...outcome.value.items]);
      setEndCursor(outcome.value.endCursor);
      setHasNextPage(outcome.value.hasNextPage);
    } else {
      setTransportFailed(true);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <PageHeader
        title="Feed"
        backHref="/"
        backLabel="Back to home"
        backTestId="feed-back"
        action={
          phase === "signedIn" ? (
            <Link
              href="/compose"
              data-testid="feed-compose"
              className={buttonClassName({ size: "sm" })}
            >
              Write a post
            </Link>
          ) : phase === "signedOut" ? (
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
      {transportFailed && (
        <div className="flex items-center gap-3">
          <TransportError testId="feed-transport-error" />
          <Button
            testId="feed-retry"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              setTransportFailed(false);
              refresh();
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {loading && <p data-testid="feed-loading">Loading…</p>}
      {!loading && !transportFailed && posts.length === 0 && (
        <p data-testid="feed-empty">Nothing here yet — write the first post.</p>
      )}
      <ul className="flex flex-col gap-3" data-testid="feed-list">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/posts/${post.id}`} data-testid={`feed-post-${post.id}`}>
              <Card>
                {post.title.value && <h2 className="font-medium">{post.title.value}</h2>}
                <p className="line-clamp-4 text-sm">{post.content.value}</p>
                {post.author && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    @{post.author.handle}
                  </p>
                )}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <Button
          testId="feed-load-more"
          variant="outline"
          onClick={() => void onLoadMore()}
          disabled={loadingMore}
        >
          Load more
        </Button>
      )}
    </main>
  );
}
