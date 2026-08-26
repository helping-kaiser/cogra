"use client";

// The topic route (D20, roadmap "Slice 2.3 — Topics"): the name, the
// follow control (D9, D10 — plain toggle, no pad), and the tagged
// content list — the content-intrinsic channel only this slice (D8).
// Ships deliberately plain: jakob is re-thinking the rest of slice 2's
// visual design, so this surface hits it once at the redesign.
//
// `hashtag(name:)` resolves any well-formed name (D4) — a Type is
// anchored vacuously, so a topic nobody has tagged yet still renders a
// page with nothing in its list. `null` answers only a
// substrate-illegal name, which reads as "not found" here.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchHashtagDetail, type HashtagDetail } from "@/lib/api/topics-api";
import { ActorChip } from "@/lib/ui/actor-chip";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";
import { PostCard } from "@/lib/ui/post-card";
import { TopicFollowControl } from "@/lib/ui/topic-follow-control";
import { TransportError } from "@/lib/ui/transport-error";

export function TopicView({ name }: { name: string }) {
  const client = useApolloClient();
  const [hashtag, setHashtag] = useState<HashtagDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [transportFailed, setTransportFailed] = useState(false);

  const refresh = useCallback(() => {
    let cancelled = false;
    void fetchHashtagDetail(client, name).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        setTransportFailed(true);
      } else if (outcome.value === null) {
        setTransportFailed(false);
        setNotFound(true);
      } else {
        setTransportFailed(false);
        setNotFound(false);
        setHashtag(outcome.value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, name]);

  useEffect(() => refresh(), [refresh]);

  const header = <PageHeader backHref="/feed" backLabel="Back to feed" backTestId="topic-back" />;

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header}
        <p>Loading…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header}
        <p role="alert" data-testid="topic-not-found">
          Not a legal topic name.
        </p>
      </main>
    );
  }

  if (hashtag === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
        {header}
        <TransportError testId="topic-transport-error" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      {header}
      <h1 className="text-headline-small" data-testid="topic-name">
        #{hashtag.name.value}
      </h1>
      {/* D10: no pad, no axis labels for a topic — a plain toggle. */}
      <TopicFollowControl name={hashtag.name.value ?? name} testIdPrefix="topic-follow" />
      <hr className="border-outline-variant" />
      <h2 className="text-title-medium">Tagged</h2>
      {hashtag.taggedContent.length === 0 && (
        <p data-testid="topic-empty">Nothing tagged here yet.</p>
      )}
      <ul className="flex flex-col gap-3" data-testid="topic-content-list">
        {hashtag.taggedContent.map((item) => {
          const node = item.node;
          if (node.__typename === "Post") {
            return (
              <li key={node.id}>
                <PostCard post={node} prefix="topic" />
              </li>
            );
          }
          if (node.__typename === "Comment") {
            const parentPost = node.target?.__typename === "Post" ? node.target : null;
            return (
              <li key={node.id}>
                <Card testId={`topic-comment-${node.id}`}>
                  {node.author && (
                    <ActorChip
                      handle={node.author.handle}
                      displayName={node.author.displayName.value}
                      testId={`topic-comment-author-${node.id}`}
                    />
                  )}
                  <p className="text-body-medium">{node.content.value}</p>
                  {parentPost && (
                    <Link
                      href={`/posts/${parentPost.id}`}
                      data-testid={`topic-comment-post-${node.id}`}
                      className="text-body-small text-on-surface-variant underline"
                    >
                      Open the post
                    </Link>
                  )}
                </Card>
              </li>
            );
          }
          // Future Taggable node kinds (Item, Chat) join without a
          // dedicated card yet — skip rather than guess a rendering.
          return null;
        })}
      </ul>
    </main>
  );
}
