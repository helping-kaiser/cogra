"use client";

// One post and its direct thread (comment.md §2), with the comment box —
// a genesis Review signed in this browser. Confirmation is asynchronous:
// a freshly signed comment appears once its record lands, so the surface
// says so instead of faking it.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { Oversight } from "@/__generated__/graphql";
import {
  fetchPostDetail,
  prepareComment,
  type CommentView,
  type PostDetail,
} from "@/lib/api/content-api";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";
import { TransportError } from "@/lib/ui/transport-error";

export function PostView({ postId }: { postId: string }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const viewerId = useActiveAccountId();
  const phase = useAuthPhase();

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<readonly CommentView[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [transportFailed, setTransportFailed] = useState(false);

  const [draft, setDraft] = useState("");
  const [attributionRequired, setAttributionRequired] = useState(false);
  const [oversight, setOversight] = useState<Oversight>("NONE");
  const [submitting, setSubmitting] = useState(false);
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);
  const [signIncomplete, setSignIncomplete] = useState(false);
  const [commentSigned, setCommentSigned] = useState(false);

  // Effect-invoked, so no synchronous setState here (the lint's
  // cascading-render guard); submit paths reset the flags themselves.
  // As in FeedView: the fault flag reflects the last COMPLETED fetch —
  // it clears only on an outcome, never eagerly, so a failed retry
  // never flashes the error surface.
  const refresh = useCallback(() => {
    let cancelled = false;
    void fetchPostDetail(client, postId).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        setTransportFailed(true);
      } else if (outcome.value === null) {
        setTransportFailed(false);
        setNotFound(true);
      } else {
        setTransportFailed(false);
        setDetail(outcome.value);
        setComments(outcome.value.comments.items);
        setEndCursor(outcome.value.comments.endCursor);
        setHasMore(outcome.value.comments.hasNextPage);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, postId]);

  useEffect(() => refresh(), [refresh]);

  const onLoadMore = async () => {
    if (!hasMore) return;
    const outcome = await fetchPostDetail(client, postId, endCursor);
    // A failed page is a fault, not a no-op: the loaded thread stays
    // and the banner above it says why nothing new arrived.
    if (outcome.kind !== "success") {
      setTransportFailed(true);
      return;
    }
    if (outcome.value === null) return;
    setTransportFailed(false);
    const next = outcome.value.comments;
    setComments((current) => [...current, ...next.items]);
    setEndCursor(next.endCursor);
    setHasMore(next.hasNextPage);
  };

  const onSubmitComment = async () => {
    if (submitting || draft.trim() === "") return;
    setSubmitting(true);
    setRefusedMessage(null);
    setSignIncomplete(false);
    setCommentSigned(false);
    const prepared = await guard.run(() =>
      prepareComment(client, {
        target: postId,
        content: draft,
        license: { attributionRequired, oversight },
      }),
    );
    if (prepared.kind === "refused") {
      setSubmitting(false);
      setRefusedMessage(prepared.errors[0]?.message ?? "The server refused this write.");
      return;
    }
    if (prepared.kind === "failed") {
      setSubmitting(false);
      setTransportFailed(true);
      return;
    }
    const results = [];
    for (const staged of prepared.value.writes) {
      results.push(await signer.signStaged(staged));
    }
    setSubmitting(false);
    if (results.every((result) => result.kind === "done")) {
      setDraft("");
      setCommentSigned(true);
    } else {
      setSignIncomplete(true);
    }
  };

  // The header rides every branch — a dead end (not found, transport
  // fault) is exactly where the back arrow matters most.
  const header = (isCreator: boolean) => (
    <PageHeader
      backHref="/feed"
      backLabel="Back to feed"
      backTestId="post-back"
      action={
        isCreator ? (
          <Link
            href={`/compose?post=${postId}`}
            data-testid="post-edit"
            className={buttonClassName({ variant: "outline", size: "sm" })}
          >
            Edit
          </Link>
        ) : undefined
      }
    />
  );

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
        {header(false)}
        <p>Loading…</p>
      </main>
    );
  }
  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
        {header(false)}
        <p role="alert" data-testid="post-not-found">
          This post no longer resolves.
        </p>
      </main>
    );
  }
  if (detail === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
        {header(false)}
        <TransportError testId="post-transport-error" />
      </main>
    );
  }

  const post = detail.post;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      {header(viewerId !== null && post.author?.id === viewerId)}
      <div>
        {post.title.value && (
          <h1 className="text-2xl font-semibold" data-testid="post-title">
            {post.title.value}
          </h1>
        )}
        {post.description.value && (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{post.description.value}</p>
        )}
      </div>
      <p className="whitespace-pre-wrap" data-testid="post-body">
        {post.content.value}
      </p>
      {post.author && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">@{post.author.handle}</p>
      )}
      <hr className="border-zinc-200 dark:border-zinc-800" />
      <h2 className="text-lg font-medium">Comments</h2>
      {transportFailed && <TransportError testId="post-thread-transport-error" />}
      {comments.length === 0 && <p data-testid="post-no-comments">No comments yet.</p>}
      <ul className="flex flex-col gap-3">
        {comments.map((comment) => (
          <li key={comment.id} data-testid={`post-comment-${comment.id}`}>
            <Card>
              <p className="text-sm">{comment.content.value}</p>
              {comment.author && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  @{comment.author.handle}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button testId="post-more-comments" variant="outline" onClick={() => void onLoadMore()}>
          Load more
        </Button>
      )}
      {phase === "signedOut" && (
        <Link
          href="/"
          data-testid="comment-signin"
          className="self-start text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          Sign in or join to comment
        </Link>
      )}
      {phase === "signedIn" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="comment-draft" className="text-sm font-medium">
            Add a comment
          </label>
          <textarea
            id="comment-draft"
            data-testid="comment-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <fieldset className="flex flex-wrap items-center gap-3 text-sm" data-testid="comment-license">
            <legend className="sr-only">License</legend>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                data-testid="comment-license-attribution"
                checked={attributionRequired}
                onChange={(event) => setAttributionRequired(event.target.checked)}
              />
              Require attribution
            </label>
            <span aria-hidden>·</span>
            <div className="flex gap-2" role="radiogroup" aria-label="AI provenance">
              {(["NONE", "CONDITIONAL", "FULL"] as const).map((value) => (
                <label key={value} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="comment-oversight"
                    data-testid={`comment-oversight-${value.toLowerCase()}`}
                    checked={oversight === value}
                    onChange={() => setOversight(value)}
                  />
                  {value === "NONE" ? "No AI" : value === "CONDITIONAL" ? "AI-assisted" : "AI-generated"}
                </label>
              ))}
            </div>
          </fieldset>
          {refusedMessage && (
            <p role="alert" data-testid="comment-refused" className="text-sm text-red-600">
              {refusedMessage}
            </p>
          )}
          {signIncomplete && (
            <p role="alert" data-testid="comment-signing-failed" className="text-sm text-red-600">
              Signing did not finish — the write stays pending.
            </p>
          )}
          {commentSigned && (
            <p data-testid="comment-signed" className="text-sm text-green-700 dark:text-green-400">
              Signed — your comment appears once its record lands. Refresh to check.
            </p>
          )}
          <Button
            testId="comment-submit"
            onClick={() => void onSubmitComment()}
            disabled={submitting || draft.trim() === ""}
          >
            Sign comment
          </Button>
        </div>
      )}
    </main>
  );
}
