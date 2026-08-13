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
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [transportFault, setTransportFault] = useState<TransportFault | null>(null);

  const [draft, setDraft] = useState("");
  const [attributionRequired, setAttributionRequired] = useState(false);
  const [oversight, setOversight] = useState<Oversight>("NONE");
  const [submitting, setSubmitting] = useState(false);
  const [refusedMessage, setRefusedMessage] = useState<string | null>(null);
  const [signIncomplete, setSignIncomplete] = useState(false);
  // A submit that never reached the server; a composer error, not a read fault.
  const [submitFailed, setSubmitFailed] = useState(false);
  const [commentSigned, setCommentSigned] = useState(false);

  // Effect-invoked, so no synchronous setState here (the lint's
  // cascading-render guard); submit paths reset the flags themselves.
  // As in FeedView: the fault reflects the last COMPLETED fetch — it
  // clears only on an outcome, never eagerly, so a failed retry never
  // flashes the error surface — and carries which fetch failed, so it
  // surfaces where that fetch was requested.
  const refresh = useCallback(() => {
    let cancelled = false;
    void fetchPostDetail(client, postId).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        setTransportFault("refresh");
      } else if (outcome.value === null) {
        setTransportFault(null);
        setNotFound(true);
      } else {
        setTransportFault(null);
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
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const outcome = await fetchPostDetail(client, postId, endCursor);
    setLoadingMore(false);
    // A failed page is a fault, not a no-op: the loaded thread stays
    // and the load-more slot says why nothing new arrived.
    if (outcome.kind !== "success") {
      setTransportFault("append");
      return;
    }
    if (outcome.value === null) return;
    setTransportFault(null);
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
    setSubmitFailed(false);
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
      setSubmitFailed(true);
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      {header(viewerId !== null && post.author?.id === viewerId)}
      <div>
        {post.title.value && (
          <h1 className="text-headline-small" data-testid="post-title">
            {post.title.value}
          </h1>
        )}
        {post.description.value && (
          <p className="text-body-medium text-on-surface-variant">{post.description.value}</p>
        )}
      </div>
      <p className="whitespace-pre-wrap" data-testid="post-body">
        {post.content.value}
      </p>
      {post.author && (
        <p className="text-body-small text-on-surface-variant">@{post.author.handle}</p>
      )}
      <hr className="border-outline-variant" />
      <h2 className="text-title-medium">Comments</h2>
      {/* A failed whole-post refresh; a failed comments page surfaces
          at the load-more slot below instead (web.md "Design
          guidelines", the Android twin). */}
      {transportFault === "refresh" && <TransportError testId="post-thread-transport-error" />}
      {comments.length === 0 && <p data-testid="post-no-comments">No comments yet.</p>}
      <ul className="flex flex-col gap-3">
        {comments.map((comment) => (
          <li key={comment.id} data-testid={`post-comment-${comment.id}`}>
            <Card>
              <p className="text-body-medium">{comment.content.value}</p>
              {comment.author && (
                <p className="text-body-small text-on-surface-variant">
                  @{comment.author.handle}
                </p>
              )}
            </Card>
          </li>
        ))}
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
      {phase === "signedOut" && (
        <Link
          href="/"
          data-testid="comment-signin"
          className="self-start text-body-medium text-on-surface-variant underline"
        >
          Sign in or join to comment
        </Link>
      )}
      {phase === "signedIn" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="comment-draft" className="text-label-large">
            Add a comment
          </label>
          <textarea
            id="comment-draft"
            data-testid="comment-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="rounded-md border border-outline p-2"
          />
          <fieldset className="flex flex-wrap items-center gap-3 text-body-medium" data-testid="comment-license">
            <legend className="sr-only">License</legend>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                data-testid="comment-license-attribution"
                className="accent-primary"
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
                    className="accent-primary"
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
            <p role="alert" data-testid="comment-refused" className="text-body-medium text-error">
              {refusedMessage}
            </p>
          )}
          {signIncomplete && (
            <p role="alert" data-testid="comment-signing-failed" className="text-body-medium text-error">
              Signing did not finish — the write stays pending.
            </p>
          )}
          {submitFailed && <TransportError testId="comment-transport-error" />}
          {commentSigned && (
            <p data-testid="comment-signed" className="text-body-medium text-success">
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
