"use client";

// The chronological listing (roadmap "Slice 2"): every post,
// newest-first in the graph's own landing order — deliberately not the
// ranked feed. Reading needs no session (web.md "Routes"), so the
// surface lives outside the (app) gate; only the write affordance
// swaps on the auth phase.
//
// IT REMEMBERS WHERE THE READER WAS — the pages they had loaded and the place
// they had reached — in `feed-memory.ts`, which says why an external store and
// not the router. Both are read at mount and applied before the first paint, so
// opening a post and coming back is not a fresh feed; `scroll-pin.ts` says why
// the place is an anchor rather than a number, and how it is held afterwards.

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchBorrowedView, fetchMe, type BorrowedVantage } from "@/lib/api/auth-api";
import { fetchPosts, type PostView } from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useRegistrationProgress } from "@/lib/signing/provider";
import { RestoreCard } from "@/app/applicant-status";
import { StatusBanners } from "@/app/status-banners";
import {
  BorrowedViewBand,
  borrowedViewLine,
  SIGN_IN_OR_JOIN,
} from "@/lib/ui/borrowed-view-band";
import { Button } from "@/lib/ui/button";
import { CograBand } from "@/lib/ui/cogra-band";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { PostCard } from "@/lib/ui/post-card";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { ANCHOR_ATTRIBUTE, usePinnedPlace } from "@/lib/ui/scroll-pin";
import { LINK_COPIED } from "@/lib/ui/share";
import { Snackbar } from "@/lib/ui/snackbar";
import { ComposeNotice, composeOutcomeOf } from "./compose-notice";
import { recallFeed, rememberFeed, rememberFeedPlace } from "./feed-memory";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

/**
 * The band, for the reader whose feed is not their own — guest, applicant,
 * and the landed member who has not pointed back yet (`design/readme.md`
 * §13; Android's twin in `feature:home`).
 *
 * WHETHER a band shows is the contract's call: `borrowedView` answers null
 * the moment the reader's own view exists — their vouch-back — and the band
 * leaving is that rule rather than a gap. The account state is asked only
 * to pick the wording, and only once there is a vantage to word.
 */
function BorrowedView({ signedOut }: { signedOut: boolean }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const [vantage, setVantage] = useState<BorrowedVantage | null>(null);
  const [member, setMember] = useState(false);

  // Re-read when the session flips, not only on mount: the answer is
  // per-reader, so a sign-in or a sign-out under a mounted feed would
  // otherwise leave the previous reader's name under the bar. The guard
  // rides along for the same reason the other reads use it — a stale
  // access token must refresh rather than demote an applicant to the
  // anonymous answer.
  useEffect(() => {
    let cancelled = false;
    void guard.run(() => fetchBorrowedView(client)).then(async (outcome) => {
      if (cancelled) return;
      // A read that did not answer names nobody: the band is an honesty
      // label over a feed already on screen, not a thing to guess at.
      const borrowed = outcome.kind === "success" ? outcome.value : null;
      setVantage(borrowed);
      if (borrowed === null || signedOut) return;
      const me = await guard.run(() => fetchMe(client));
      if (cancelled) return;
      // An unanswered account read takes the applicant's line: it is the
      // weaker claim, where the vouch-back line asks for an act.
      setMember(me.kind === "success" && me.value.accountState === "MEMBER");
    });
    return () => {
      cancelled = true;
    };
  }, [client, guard, signedOut]);

  if (vantage === null) return null;
  const { handle } = vantage;
  const line = signedOut
    ? borrowedViewLine.join(handle)
    : member
      ? borrowedViewLine.vouchBack(handle)
      : borrowedViewLine.applicant(handle);
  return (
    <BorrowedViewBand
      testId="feed-borrowed-view"
      handle={handle}
      displayName={vantage.displayName.value}
      line={line}
      // The action rides the guest's reading alone. The other two name an
      // act performed elsewhere — the application runs itself, the
      // vouch-back has its own card below — and one act offered by two
      // controls on one screen is the ambiguity §2.4 refuses.
      actionLabel={signedOut ? SIGN_IN_OR_JOIN : undefined}
      // Pushes /login, so back returns to the reading context.
      onAction={signedOut ? () => router.push("/login") : undefined}
    />
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
  // Read ONCE, at mount, through a lazy state initializer — the one thing
  // that may be read during render and never changes under it. What the feed
  // left behind last time it was on screen; seeding the state below from it is
  // what makes the pages come back on the FIRST render, before any paint.
  const [remembered] = useState(recallFeed);
  const [rememberedPlace] = useState(() => remembered?.place ?? null);
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

  // A remembered feed is not re-fetched on arrival. A refresh takes no cursor,
  // so it would answer with page one and throw away every page after it —
  // which is the loss this whole file exists to stop. New posts arrive when the
  // reader asks: the pull below, a Retry, or a reload.
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

  // The place, held against everything that lands late — `scroll-pin.ts` says
  // why an offset alone drifts. Read once, like the pages: the memory's place
  // is rewritten as the reader scrolls, and the landing is the place they left.
  const { release: releasePin } = usePinnedPlace({
    host,
    place: rememberedPlace,
    record: rememberFeedPlace,
  });

  // The reader's own ask for newer posts (design readme §13, the bottom bar's
  // re-tap ladder: pull-down at the feed's top is one of the feed's two refresh
  // routes). It goes through the same fetch the first arrival takes, so the
  // fault it can raise surfaces in the same place. Asking is a move, so the
  // place stops being held.
  const onPull = useCallback(() => {
    releasePin();
    setLoading(true);
    refresh();
  }, [releasePin, refresh]);
  usePullToRefresh({ host, onPull });

  const loadMore = useCallback(async () => {
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
  }, [client, endCursor, hasNextPage, loadingMore]);

  // THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING (design readme §13, the
  // audit states): no Show more, no page numbers — nothing drawn at rest. The
  // watch sits a few posts short of the end so the page is already on its way
  // by the time the reader gets there. A page that failed is not re-asked
  // automatically: the drawn Retry below is the way back.
  const tailRef = useApproachingTail({
    root: host,
    onReach: loadMore,
    enabled: hasNextPage && transportFault !== "append",
  });
  const tailIndex = tailIndexOf(posts.length);

  return (
    // The band is chrome and full-bleed, so the gutter belongs to the content
    // below it rather than to the column that holds both.
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-6">
      <CollapsingTop
        // Mirrors `scroll-pin.ts`'s own "nothing is anchored at the origin":
        // a restored offset of 0 is a top arrival, so the header stays. Read
        // from the same lazy-state source the restore itself reads, so this
        // and the actual landing offset can never disagree.
        initiallyHidden={rememberedPlace !== null && rememberedPlace.offset > 0}
      >
        {/* A tab root wears the mark, not a page title: the reader knows which
            tab they are on from the bar, and the band's other half works. */}
        <CograBand>
          {/* The band carries its own gutter — it is a bare line under the
              identity band, not a card in the stack below it. Nothing is
              drawn while the phase resolves: the two readings differ, and
              guessing puts the wrong sentence on screen for a frame. */}
          {phase !== "resolving" && <BorrowedView signedOut={phase === "signedOut"} />}
          <div className="flex flex-col gap-4 px-6">
            {/* Must-act, so it collapses into the header and follows the
                reader back up instead of living only at the top. */}
            {phase === "signedIn" && keyOnDevice === false && !noKeyYet && <RestoreCard />}
          </div>
        </CograBand>
      </CollapsingTop>
      <div className="flex flex-col gap-4 px-6">
        {/* The account-status banners ride the active tab (design.md §6). */}
        {phase === "signedIn" && <StatusBanners />}
        {/* What the wizard just did, if anything. Dismissing drops the query
            value, so the notice cannot come back on a reload. */}
        {outcome !== null && (
          <ComposeNotice onDismiss={() => router.replace("/feed", { scroll: false })} />
        )}
        {transportFault === "refresh" && (
          <div className="flex items-center gap-3">
            {/* With posts on screen the fault means "stale", not "gone":
                the loaded posts stay readable under this banner. A failed
                page fetch surfaces where the page would have been instead
                (web.md "Design guidelines", the Android twin). */}
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
        {loading && (
          <p
            role="status"
            aria-live="polite"
            data-testid="feed-loading"
            className="text-body-medium text-on-surface-variant"
          >
            Loading…
          </p>
        )}
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
        {posts.map((post, index) => (
          // The card names itself to the pin: it is the anchor the reader's
          // place is measured against (`scroll-pin.ts`). One of them also
          // carries the watch that fetches the next page.
          <li
            key={post.id}
            {...{ [ANCHOR_ATTRIBUTE]: post.id }}
            ref={index === tailIndex ? tailRef : undefined}
          >
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
        {/* The slot the next page fills. At rest it is empty — the page comes
            because the reader kept going. In flight it is the list's own
            loading line, and a page that did not arrive stands here with its
            way back (`ProfileMoreFailed`, the drawn twin of this row). */}
        {hasNextPage && transportFault === "append" && (
          <div className="flex items-center justify-center gap-3">
            <TransportError
              testId="feed-load-more-error"
              message="Can't reach the server — new posts can't load right now."
            />
            <Button
              testId="feed-load-more-retry"
              variant="outline"
              size="sm"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              Retry
            </Button>
          </div>
        )}
        {loadingMore && (
          <p
            role="status"
            aria-live="polite"
            data-testid="feed-loading-more"
            className="text-body-medium text-on-surface-variant"
          >
            Loading…
          </p>
        )}
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
