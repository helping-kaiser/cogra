"use client";

// The ranked feed (roadmap slice 3; ranked-feed packet §4.12): one ranking
// of the reader's view — or the view they borrow — computed by the server's
// ranker and held here whole; the list on screen is DERIVED from it on this
// device (`lib/feed/ranked-feed.ts`) and hydrated a window at a time. It
// replaced the chronological `posts` listing, which stood in as the feed's
// order until the ranker shipped (§4.9). Reading needs no session (web.md
// "Routes"), so the surface lives outside the (app) gate; only the write
// affordance swaps on the auth phase.
//
// WHEN IT RANKS (CD-1, PR-55): at its first open in a page load — a cold
// start always ranks — and when the reader pulls or retries. A return from the
// background never does: nothing here listens for it. A sheet Done ranks only
// when it changed the ranker's arguments; every other Done re-derives the held
// answer locally (`feed-done.ts`).
//
// IT REMEMBERS WHERE THE READER WAS — the pages they had loaded and the place
// they had reached — in `feed-memory.ts`, which says why an external store and
// not the router. Both are read at mount and applied before the first paint, so
// opening a post and coming back is not a fresh feed; `scroll-pin.ts` says why
// the place is an anchor rather than a number, and how it is held afterwards.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchBorrowedView, fetchMe, type BorrowedVantage } from "@/lib/api/auth-api";
import type { PostView } from "@/lib/api/content-api";
import { fetchFeedRanking, fetchFeedWindow } from "@/lib/api/feed-api";
import { failed, success } from "@/lib/api/outcome";
import { appendDeduped } from "@/lib/api/pagination";
import { onFeedDone } from "@/lib/feed/feed-done";
import { RankedFeed, type FeedIo, type FeedWindow } from "@/lib/feed/ranked-feed";
import { seenRecord } from "@/lib/history/seen-record";
import { SEEN_ATTRIBUTE, useSeenTracker } from "@/lib/history/seen-tracker";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useRegistrationProgress } from "@/lib/signing/provider";
import { onStanceSigned } from "@/lib/stance/signed-events";
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
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { PostCard } from "@/lib/ui/post-card";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { ANCHOR_ATTRIBUTE, usePinnedPlace } from "@/lib/ui/scroll-pin";
import { LINK_COPIED } from "@/lib/ui/share";
import { Snackbar } from "@/lib/ui/snackbar";
import * as clipMemory from "@/lib/ui2/media/clip-memory";
import { StageHost } from "@/lib/ui2/media/stage-host";
import { CommentsSheet } from "@/app/comments/comments-sheet";
import { ComposeNotice, composeOutcomeOf } from "./compose-notice";
import { recallFeed, rememberFeed, rememberFeedPlace } from "./feed-memory";
import { VouchCard } from "./vouch-card";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

/** Every clip a list of posts draws, by the media id the clip memory keys on. */
function clipIdsOf(posts: readonly PostView[]): string[] {
  return posts.flatMap((post) => post.attachments.map((attachment) => attachment.id));
}

/**
 * The band, for the reader whose feed is not their own — guest, applicant,
 * and the landed member who has signed no opinion yet (`design/readme.md`
 * §13; Android's twin in `feature:home`).
 *
 * WHETHER a band shows is the contract's call: `borrowedView` answers null
 * the moment the reader's own view exists — their first signed opinion,
 * toward anyone (VouchBack.md:21) — and the band leaving is that rule rather
 * than a gap. The account state is asked only to pick the wording, and only
 * once there is a vantage to word.
 *
 * SO IT RE-READS WHEN A STANCE IS SIGNED, on any surface: the band leaves at
 * once and the feed reads the own view from its next refresh, never a reload
 * at the signing (:21, ruling 57). It re-reads with the feed's own refresh
 * too, which is where a first opinion that expired with nothing landed
 * brings it back (:23).
 */
function BorrowedView({
  signedOut,
  refreshSignal,
}: {
  signedOut: boolean;
  refreshSignal: number;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const [vantage, setVantage] = useState<BorrowedVantage | null>(null);
  const [member, setMember] = useState(false);
  const [signedSignal, setSignedSignal] = useState(0);

  useEffect(() => onStanceSigned(() => setSignedSignal((n) => n + 1)), []);

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
  }, [client, guard, signedOut, signedSignal, refreshSignal]);

  if (vantage === null) return null;
  const { handle } = vantage;
  const memberReading = !signedOut && member;
  const line = signedOut
    ? borrowedViewLine.join(handle)
    : memberReading
      ? borrowedViewLine.member(handle)
      : borrowedViewLine.applicant(handle);
  return (
    <BorrowedViewBand
      testId="feed-borrowed-view"
      // The member's band is the one a registered board draws (VouchBack);
      // the guest's and the applicant's keep their own ids.
      node={memberReading ? { path: "feed.borrowedViewBand" } : undefined}
      handle={handle}
      displayName={vantage.displayName.value}
      avatarUrl={"avatar" in vantage ? (vantage.avatar?.url ?? null) : null}
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
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const account = useActiveAccountId();
  // THE READER — whose seen record cuts the feed, never whose view it ranks
  // (§4.3): a borrowed view ranks the lender, and the reader's own seeing is
  // still what is cut from it. Signed out, there is no reader and no record.
  const reader = phase === "signedIn" ? account : null;
  const router = useRouter();
  const outcome = composeOutcomeOf(useSearchParams().get("compose"));
  const host = useScrollHost();
  // Read ONCE, at mount, through a lazy state initializer — the one thing
  // that may be read during render and never changes under it. What the feed
  // left behind last time it was on screen for this reader; seeding the state
  // below from it is what makes the pages come back on the FIRST render,
  // before any paint.
  const [remembered] = useState(() => recallFeed(reader));
  // The held ranking. It outlives this mount through the memory, and a
  // different reader gets a feed of their own (`feed-memory.ts`).
  const feedRef = useRef<RankedFeed | null>(remembered?.feed ?? null);
  const feedFor = useCallback((who: string | null): RankedFeed => {
    if (feedRef.current === null || feedRef.current.reader !== who) {
      feedRef.current = new RankedFeed(who);
    }
    return feedRef.current;
  }, []);
  // Whether this mount is still on screen. A ranking runs several reads in a
  // row; once the feed has left, the rest of them are not asked at all.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // The reads the held ranking is handed per call (`ranked-feed.ts`).
  const io = useMemo<FeedIo>(() => {
    const gone = () => Promise.resolve(failed(new Error("the feed left the screen")));
    return {
      // CD-5: the borrowed vantage when there is one — a guest's, an
      // applicant's, a member's before their first opinion — else the
      // reader's own actor. Asked at every ranking, so the hand-over reads
      // the own view from the next refresh (blessing 57).
      resolveViewer: async () => {
        if (!alive.current) return gone();
        const borrowed = await guard.run(() => fetchBorrowedView(client));
        if (borrowed.kind !== "success") return borrowed;
        return success(borrowed.value?.id ?? reader);
      },
      rank: (viewer, args) => (alive.current ? fetchFeedRanking(client, viewer, args) : gone()),
      hydrate: (ids) => (alive.current ? fetchFeedWindow(client, ids) : gone()),
      seen: async () => {
        await seenRecord.use(reader);
        return seenRecord;
      },
      wanted: () => alive.current,
    };
  }, [client, guard, reader]);
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
  // The band's chats affordance, signed out: the guest gate the canvas
  // draws (`graph.json` "FeedBare" → `GuestGate`) — ask, never bounce.
  const [chatsPrompting, setChatsPrompting] = useState(false);
  // WHOSE THREAD IS UP. A card's comment count raises the one comments
  // surface over this list (jakob 2026-09-15) — a layer, never a destination,
  // so the feed keeps its pages and its place underneath and the composer the
  // sheet opens comes back to the thread, not to the feed.
  //
  // The post OUTLIVES the flag, the way the license block does on the detail:
  // the sheet is still on screen through its own exit animation, and a sheet
  // whose post vanished mid-exit would blank out. It is also what lets a
  // second raise of the same thread keep what the reader had already unfolded.
  const [commentsPost, setCommentsPost] = useState<PostView | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // What the raised thread last said its length was, and which post's it is:
  // one sheet answers whichever count was tapped, so the number it reports
  // belongs to that card alone and not to whatever card is drawn next.
  const [liveComments, setLiveComments] = useState<{ id: string; total: number } | null>(null);

  // Effect-invoked, so no synchronous setState here; the retry button
  // resets the loading state in its own handler. The fault reflects
  // the last COMPLETED fetch — clearing it eagerly at fetch start
  // made the banner vanish and reappear on every failed retry. It
  // also carries which fetch failed, so the fault can surface where
  // that fetch was requested.
  // THE LIST'S CLIPS, AS OF THE LAST RENDER — what a refresh re-stills.
  const postsNow = useRef(posts);
  useEffect(() => {
    postsNow.current = posts;
  }, [posts]);
  // Which refreshed list is on screen: the stage and its clips are built anew
  // for each one (see `restill` below).
  const [listEra, setListEra] = useState(0);

  // WHICH ASK IS CURRENT. A ranking, a pull and a Done can overlap; only the
  // newest one's answer reaches the screen, and nothing lands after unmount.
  const ask = useRef(0);

  /** Puts the derived list's first window on screen. */
  const showFirst = useCallback((first: FeedWindow) => {
    setPosts(first.items);
    setEndCursor(first.hasMore ? String(first.next) : null);
    setHasNextPage(first.hasMore);
  }, []);

  const refresh = useCallback(
    (restill = false) => {
      const mine = ++ask.current;
      const feed = feedFor(reader);
      void (async () => {
        const ranked = await feed.refresh(io);
        const first = ranked.kind === "success" ? await feed.window(0, io) : ranked;
        if (!alive.current || mine !== ask.current) return;
        setLoading(false);
        if (first.kind === "success") {
          setTransportFault(null);
          if (restill) {
            // "WHEN the list holding feed.card refreshes -> feed.card.media.frame
            // wears its clip's stored still again" (FeedCover.md:13; RULINGS
            // "pull-to-refresh RESETS the reached-frame memory"). The session
            // forgets the clips of the list as it stood and as it arrives, and
            // the list's players are built anew — a played `<video>` keeps its
            // frame for as long as it lives — on a stage that decides from
            // empty, as a fresh list's does (the packet §3.2 rule 6).
            clipMemory.forgetList(clipIdsOf([...postsNow.current, ...first.value.items]));
            setListEra((era) => era + 1);
          }
          showFirst(first.value);
        } else {
          // A failed ranking keeps the held snapshot on screen (§4.5): the
          // fault rides above it, and nothing silently stands in for it.
          setTransportFault("refresh");
        }
      })();
    },
    [feedFor, io, reader, showFirst],
  );

  // THE FIRST OPEN RANKS — once per reader per page load. A feed remembered
  // for this reader is not ranked again on arrival: a navigation back finds
  // the list it left, and so does a return from the background, which nothing
  // here listens for (PR-55). New rows arrive when the reader asks: the pull
  // below, a Retry, or a reload — which is a cold start, and always ranks.
  // Nothing is asked while the session resolves: whose view and whose record
  // are both the reader's to say.
  const openedFor = useRef<string | null | undefined>(
    remembered !== null ? remembered.feed.reader : undefined,
  );
  useEffect(() => {
    if (phase === "resolving" || openedFor.current === reader) return;
    openedFor.current = reader;
    refresh();
  }, [phase, reader, refresh]);

  // A SHEET DONE (CD-1): the held ranking decides whether it ranks again or
  // re-derives locally, and the derived list's first window replaces the one
  // on screen. A re-derive asks the ranker nothing.
  useEffect(
    () =>
      onFeedDone((staged) => {
        const feed = feedRef.current;
        if (feed === null) return;
        const mine = ++ask.current;
        void (async () => {
          const done = await feed.done(staged, io);
          if (done.kind === "success" && done.value === "nothing") return;
          const first = done.kind === "success" ? await feed.window(0, io) : done;
          if (!alive.current || mine !== ask.current) return;
          if (first.kind === "success") {
            setTransportFault(null);
            showFirst(first.value);
          } else {
            setTransportFault("refresh");
          }
        })();
      }),
    [io, showFirst],
  );

  // The pages, kept for the next mount. Written from an effect rather than
  // from each fetch so no path can set state and forget to record it.
  useEffect(() => {
    const feed = feedRef.current;
    if (loading || feed === null) return;
    rememberFeed({ feed, posts, endCursor, hasNextPage });
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
    refresh(true);
  }, [releasePin, refresh]);
  usePullToRefresh({ host, onPull, enabled: !commentsOpen });

  // The next window of the derived list — a hydration, never a ranking: the
  // order was fixed when the list was derived, and nothing in it moves while
  // the reader scrolls (W-6).
  const loadMore = useCallback(async () => {
    const feed = feedRef.current;
    if (loadingMore || !hasNextPage || endCursor === null || feed === null) return;
    const mine = ask.current;
    setLoadingMore(true);
    const outcome = await feed.window(Number(endCursor), io);
    if (!alive.current) return;
    setLoadingMore(false);
    // A refresh or a Done that landed meanwhile replaced the list this page
    // was cut from.
    if (mine !== ask.current) return;
    if (outcome.kind === "success") {
      setTransportFault(null);
      setPosts((current) => appendDeduped(current, outcome.value.items));
      setEndCursor(outcome.value.hasMore ? String(outcome.value.next) : null);
      setHasNextPage(outcome.value.hasMore);
    } else {
      setTransportFault("append");
    }
  }, [endCursor, hasNextPage, io, loadingMore]);

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

  // A POST WHOLLY ON SCREEN JOINS HISTORY (History.md:5) — the card's own
  // post, never its author or tags. Attached at the list, so the card stays
  // the feed's (`seen-tracker.ts` says what counts and when it is sent).
  const listRef = useRef<HTMLUListElement>(null);
  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  useSeenTracker({ root: host, list: listRef, ids: postIds, suspended: commentsOpen });

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
        <CograBand
          node={{ path: "feed.band" }}
          deletionBandNode={{ path: "feed.deletionBand" }}
          // The chats affordance (jakob 2026-09-01). A signed-out tap
          // opens the guest gate, the edge the canvas draws
          // (`graph.json` "FeedBare" → `GuestGate`); a signed-in tap
          // reaches the coming-soon destination (`graph.json` "Feed" →
          // `ChatsComingSoon`, backlog item 68). Nothing is drawn while
          // the phase resolves, matching every other read below.
          onChats={
            phase === "signedOut"
              ? () => setChatsPrompting(true)
              : phase === "signedIn"
                ? () => router.push("/chats")
                : undefined
          }
        >
          {/* The band carries its own gutter — it is a bare line under the
              identity band, not a card in the stack below it. Nothing is
              drawn while the phase resolves: the two readings differ, and
              guessing puts the wrong sentence on screen for a frame. */}
          {phase !== "resolving" && (
            <BorrowedView signedOut={phase === "signedOut"} refreshSignal={listEra} />
          )}
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
      {/* THE FEED'S ONE STAGE (Feed.md:3–55): every clip in the list — a
          post's, and a comment card's when the feed draws one (Feed.md:7) —
          competes for it, and it lands at the feed's own hard top. */}
      <StageHost key={listEra}>
        <ul ref={listRef} className="flex flex-col gap-2" data-testid="feed-list">
          {/* The vouch card is the list's first child, above the posts
              (`VouchBack.jsx`), after the security notice and the key card
              that head the column (ruling 45). */}
          {phase === "signedIn" && <VouchCard refreshSignal={listEra} />}
          {posts.map((post, index) => (
            // The card names itself to the pin: it is the anchor the reader's
            // place is measured against (`scroll-pin.ts`). One of them also
            // carries the watch that fetches the next page.
            <li
              key={post.id}
              {...{ [ANCHOR_ATTRIBUTE]: post.id, [SEEN_ATTRIBUTE]: post.id }}
              ref={index === tailIndex ? tailRef : undefined}
            >
              <PostCard
                post={post}
                // The registered Feed screen's card, keyed by the post's id —
                // the record's own identity, where the board keys its sample
                // cards by author (`design/designs/canonical/nodes.json`).
                node={{ path: "feed.card", key: post.id }}
                href={`/posts/${post.id}`}
                testId={`feed-post-${post.id}`}
                authorTestId={`feed-author-${post.id}`}
                stanceTestId={`feed-stance-${post.id}`}
                comments={
                  liveComments?.id === post.id ? liveComments.total : post.comments.totalCount
                }
                // THE COUNT RAISES THE THREAD (graph.json: every `comment count`
                // edge advances to `ReplyEntry`) — the card's own tap opens the
                // post, which is the different intent.
                onOpenComments={() => {
                  setCommentsPost(post);
                  setCommentsOpen(true);
                }}
                onLinkCopied={() => setLinkCopied(true)}
              />
            </li>
          ))}
        </ul>
      </StageHost>
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
      {/* Conditionally mounted, matching `stance-control.tsx`'s own guest
          gate: `JoinPrompt` always draws its `data-testid`, so a second one
          mounted unconditionally alongside a post card's own gate collides
          on it the moment both ride the same tree. */}
      {chatsPrompting && <JoinPrompt open onClose={() => setChatsPrompting(false)} />}
      {/* THE ONE COMMENTS SURFACE, over the feed. It owns its own read, so a
          card's count raises the same full-function thread the detail's does —
          and the reader comes back to this list exactly where they left it. */}
      {commentsPost !== null && (
        <CommentsSheet
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
          post={commentsPost}
          store={store}
          onCount={(total) => setLiveComments({ id: commentsPost.id, total })}
        />
      )}
    </main>
  );
}
