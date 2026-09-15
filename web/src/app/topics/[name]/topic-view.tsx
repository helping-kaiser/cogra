"use client";

// The topic route (D20, roadmap "Slice 2.3 — Topics"): the name, the
// stance row, and the tagged content list — the content-intrinsic
// channel only this slice (D8).
//
// THE HEADER CARRIES NO CONTROL AND THE ROW BELOW IT DOES (`TagPage`,
// the topic round 2026-09-14). A stance anchor on the header's trailing
// edge read as a stance readout for the post the reader arrived from; a
// row of its own, under the title and above anything belonging to a
// post, cannot. THE GESTURE IS AN AFFINITY — the same ceremony every
// stance uses, wearing the family's own six words (`AFFINITY_AXES`) —
// so there is no toggle and no one-tap follow, and the word "follow" is
// not on the screen (copy-voice's ban, extended to topics).
//
// A GUEST REACHES IT LIKE ANYONE ELSE (backlog item 81, ruled
// 2026-09-15). The page is public, the face wears the no-opinion 🫥 that
// a viewer with no bundle always wears, and the tap raises the join
// prompt — all of which the control already does behind `signedIn`.
//
// THE EMPTY PAGE WIRES NO FACE AT ALL (the same ruling), which is why
// the row sits inside the populated branch. `TagPageEmpty`'s own prose
// still argues that from the pre-topic-round premise that the populated
// page carries no control either — reported, not resolved here.
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
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";
import { PostCard } from "@/lib/ui/post-card";
import { LINK_COPIED } from "@/lib/ui/share";
import { StanceControl } from "@/lib/ui/stance-control";
import { AFFINITY_AXES } from "@/lib/ui/stance-format";
import { Snackbar } from "@/lib/ui/snackbar";
import { TransportError } from "@/lib/ui/transport-error";

export function TopicView({ name }: { name: string }) {
  const client = useApolloClient();
  const [hashtag, setHashtag] = useState<HashtagDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const dismissLinkCopied = useCallback(() => setLinkCopied(false), []);

  const refresh = useCallback(() => {
    let cancelled = false;
    void fetchHashtagDetail(client, name).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        // hashtag stays null; the transport-fault branch below reads
        // exactly that, distinguished from notFound by the flag.
        return;
      }
      if (outcome.value === null) {
        setNotFound(true);
      } else {
        setNotFound(false);
        setHashtag(outcome.value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, name]);

  useEffect(() => refresh(), [refresh]);

  const header = (
    <PageHeader backHref="/feed" backScroll={false} backLabel="Back to feed" backTestId="topic-back" />
  );

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
        <div className="flex items-center gap-3">
          <TransportError testId="topic-transport-error" />
          <Button
            testId="topic-retry"
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      {header}
      <h1 className="text-headline-small" data-testid="topic-name">
        #{hashtag.name.value}
      </h1>
      {/* Under the title, above anything belonging to a post. It NAMES
          WHAT IT STANCES — the tag itself, hash and all — because more
          than one stance control stands on this page and the face's
          accessible name is what says which is which.

          A name moderation has taken away is a topic with nothing to
          stance toward: the canonical name IS the target's identity
          (hashtag.md §1), so the row waits for one rather than signing
          against a blank. */}
      {hashtag.name.value !== null && hashtag.taggedContent.length > 0 && (
        <StanceControl
          target={{ id: hashtag.name.value, kind: "topic", label: `#${hashtag.name.value}` }}
          testIdPrefix="topic-affinity"
          axes={AFFINITY_AXES}
        />
      )}
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
                <PostCard
                  post={node}
                  href={`/posts/${node.id}`}
                  testId={`topic-post-${node.id}`}
                  authorTestId={`topic-author-${node.id}`}
                  stanceTestId={`topic-stance-${node.id}`}
                  comments={node.comments.totalCount}
                  onLinkCopied={() => setLinkCopied(true)}
                />
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
                      avatarUrl={node.author.avatar?.url}
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
      {/* One region for the list: a card that copied a link says so here. */}
      <Snackbar
        testId="topic-link-copied"
        message={linkCopied ? LINK_COPIED : null}
        onDismiss={dismissLinkCopied}
      />
    </main>
  );
}
