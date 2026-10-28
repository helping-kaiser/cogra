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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchBorrowedView, fetchMe, type BorrowedVantage } from "@/lib/api/auth-api";
import type { PostView } from "@/lib/api/content-api";
import { fetchFeedRanking, fetchFeedWindow } from "@/lib/api/feed-api";
import { failed, success } from "@/lib/api/outcome";
import { appendDeduped } from "@/lib/api/pagination";
import { withCachedRemoval } from "@/lib/api/removal-api";
import { onFeedDone } from "@/lib/feed/feed-done";
import { onFeedReselect } from "@/lib/feed/feed-reselect";
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
import { useBellLit, useFreshRootBell } from "@/lib/notifications/bell";
import { notificationsHref } from "@/lib/notifications/origin";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { PostCard } from "@/lib/ui/post-card";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { scrollHostToTopAnimated, scrollOffsetOf, useScrollHost } from "@/lib/ui/scroll-host";
import { ANCHOR_ATTRIBUTE, usePinnedPlace } from "@/lib/ui/scroll-pin";
import { LINK_COPIED } from "@/lib/ui/share";
import { useHiddenSet } from "@/lib/hidden/provider";
import { useNewerVersionAnnouncement } from "@/lib/release/newer-version-announcer";
import { useHostSnack } from "@/lib/saved/save-row";
import { Snackbar } from "@/lib/ui/snackbar";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import * as clipMemory from "@/lib/ui2/media/clip-memory";
import type { PostMenuRow } from "@/lib/ui2/post-menu";
import { PostMenuHost } from "@/lib/ui2/post-menu-host";
import { StageHost } from "@/lib/ui2/media/stage-host";
import { CommentsSheet } from "@/app/comments/comments-sheet";
import { ComposeNotice, composeOutcomeOf } from "./compose-notice";
import { recallFeed, rememberFeed, rememberFeedPlace } from "./feed-memory";
import { VouchCard } from "./vouch-card";
import { TransportError, type TransportFault } from "@/lib/ui/transport-error";

/**
 * The rows FeedPostMenu registers (`feed.menuSheet.*`) — the reader menu's.
 * The author's own rows on the feed have no drawn board, so they keep their
 * own ids rather than wear a path the registry does not hold.
 */
const FEED_MENU_ROWS: ReadonlySet<PostMenuRow> = new Set([
  "save",
  "cite",
  "hide",
  "license",
  "report",
]);

function feedMenuRow(row: PostMenuRow): DataNode | undefined {
  return FEED_MENU_ROWS.has(row) ? { path: `feed.menuSheet.${row}` } : undefined;
}

/** No row under the separator: the list before its first derive. */
const NO_SEEN_TAIL: ReadonlySet<string> = new Set();

const SEEN_SEPARATOR: DataNode = { path: "feed.seenSeparator" };

/**
 * `feed.seenSeparator` (FeedSeenTail.md, the `FeedSeenTail` board): a hairline
 * with "Already seen" centred on it, quiet, and no control — the board's 12px
 * gap and 8px/24px padding, the hairline `--border-hairline`
 * (`outline-variant`), the words label-small in `--text-secondary`
 * (`on-surface-variant`).
 */
function SeenSeparator() {
  return (
    <li className="flex items-center gap-3 px-6 py-2" {...testAttributes(SEEN_SEPARATOR)}>
      <span aria-hidden="true" className="h-px flex-1 bg-outline-variant" />
      <span
        className="flex-none text-label-small text-on-surface-variant"
        {...testAttributes(part(SEEN_SEPARATOR, "label"))}
      >
        Already seen
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-outline-variant" />
    </li>
  );
}

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
  // THE READER'S HIDDEN SET (hidden-actors packet §4.3): a post-rank filter on
  // this device, never a ranking input. A row whose author is hidden leaves
  // the list — unless a hide or its Undo made from that very row did not go
  // through, when the row stands carrying its line (design digest item 55).
  const hidden = useHiddenSet();
  const hides = useCallback(
    (post: PostView) =>
      reader !== null &&
      post.author != null &&
      hidden.has(post.author.id) &&
      hidden.failure(post.id) === null,
    [hidden, reader],
  );
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
      hides: (item) => hides(item as PostView),
    };
  }, [client, guard, reader, hides]);
  const [rememberedPlace] = useState(() => remembered?.place ?? null);
  // A REMOVAL TAKEN WHILE THE FEED WAS AWAY (on the detail) reached the cache,
  // not the memory — so the remembered pages come back wearing what the cache
  // has learned of their marks, never showing a removed post whole.
  const [posts, setPosts] = useState<readonly PostView[]>(() =>
    (remembered?.posts ?? []).map((post) => withCachedRemoval(client, post)),
  );
  const [endCursor, setEndCursor] = useState<string | null>(remembered?.endCursor ?? null);
  const [hasNextPage, setHasNextPage] = useState(remembered?.hasNextPage ?? false);
  // THE SEEN TAIL (FeedSeenTail.md): which of the list's rows stand under the
  // separator — fixed when the list was derived, like its order, so a row seen
  // on screen moves only at the next load, refresh or re-derive.
  const [seenTail, setSeenTail] = useState<ReadonlySet<string>>(
    () => remembered?.feed.seenTail ?? NO_SEEN_TAIL,
  );
  const [loading, setLoading] = useState(remembered === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transportFault, setTransportFault] = useState<TransportFault | null>(null);
  // THE FEED'S ONE SNACKBAR (`feed.snackbar`): a copied link, and the
  // aftermath of what the card menus did.
  const { snack, notify, dismiss: dismissSnack } = useHostSnack();
  // A NEWER VERSION, SAID ONCE (FeedNewerVersion.md): on the feed's arrival
  // in a cold open, the same one snackbar — queued behind whatever it is
  // already saying, as Material shows one at a time.
  const newer = useNewerVersionAnnouncement(!loading, snack === null);
  // THE ONE MENU SHEET THE CARDS SHARE (ruling 84, FeedPostMenu.md:3): a
  // card's ⋮ raises it over the feed, which stands unchanged beneath. The post
  // outlives the flag so the sheet does not blank out through its exit.
  const [menuPost, setMenuPost] = useState<PostView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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
  // THE BELL LIGHTS ON A FRESH LOAD OF THIS ROOT (FeedUnread.md:3, :5): an
  // arrival with nothing remembered, or a pull. A remembered feed coming back
  // by back or the bar is a return, and never lights it (:9).
  useFreshRootBell(reader, remembered === null || listEra > 0, listEra);
  const bellIsLit = useBellLit(reader);

  // WHICH ASK IS CURRENT. A ranking, a pull and a Done can overlap; only the
  // newest one's answer reaches the screen, and nothing lands after unmount.
  const ask = useRef(0);

  /** Puts the derived list's first window on screen. */
  const showFirst = useCallback((first: FeedWindow) => {
    setPosts(first.items);
    setSeenTail(first.seenTail);
    setEndCursor(first.hasMore ? String(first.next) : null);
    setHasNextPage(first.hasMore);
  }, []);

  const refresh = useCallback(
    (restill = false) => {
      const mine = ++ask.current;
      const feed = feedFor(reader);
      void (async () => {
        // THE FEED NEVER RENDERS A PAGE BEFORE THE HIDDEN SET HAS BEEN READ
        // (§5.1): both reads go together, and a set that could not be read at
        // all is the feed's own fault — never an unfiltered page. Every open
        // and every pull reads it again, so a hide made on another device
        // reaches this one.
        const [ranked, setRead] = await Promise.all([
          feed.refresh(io),
          reader === null ? Promise.resolve(true) : hidden.refetch(),
        ]);
        const hiddenKnown = setRead || hidden.status === "read";
        const first =
          ranked.kind !== "success"
            ? ranked
            : hiddenKnown
              ? await feed.window(0, io)
              : failed(new Error("the hidden set could not be read"));
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
    [feedFor, hidden, io, reader, showFirst],
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
  // A RETURN TO THE FEED reads the hidden set again even where the list is
  // the remembered one (§5.1, "at every feed open"); the list on screen is
  // filtered by the set already held meanwhile.
  useEffect(() => {
    if (remembered !== null && reader !== null) void hidden.refetch();
  }, [hidden, reader, remembered]);

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

  // THE WAY BACK UP (FeedScrolled.md:11-13): the list goes to the top,
  // animated, and NEVER refreshes — the pill's tap and the bar's re-tap from a
  // scrolled root alike. Going up is a move, so the place stops being held.
  const goToTop = useCallback(() => {
    releasePin();
    scrollHostToTopAnimated(host);
  }, [host, releasePin]);

  // THE BAR'S RE-TAP OVER THE ROOT (Feed.md:81-91): scrolled, it is the way up;
  // already at the top, it is the feed's other refresh route, the one a pull
  // takes there.
  useEffect(
    () => onFeedReselect(() => (scrollOffsetOf(host) > 0 ? goToTop() : onPull())),
    [goToTop, host, onPull],
  );

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
  // WHAT IS DRAWN: the held pages less the hidden people's rows (FeedHidden.md
  // :3) — they leave, the rows behind move up, and nothing marks the space.
  // The pages themselves keep them, so Undo stands the feed as it was (:11)
  // and a hide made on another surface clears this list on return (:9).
  const hiddenVersion = hidden.snapshot();
  const shown = useMemo(
    () => posts.filter((post) => !hides(post)),
    // The set changes under a stable `hides`; its version says when.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, hides, hiddenVersion],
  );
  const tailIndex = tailIndexOf(shown.length);
  // A hide that took every drawn row while more pages wait: the tail watch has
  // nothing to hang on, so the next page is asked for here.
  const emptiedByHide = !loading && shown.length === 0 && posts.length > 0;
  useEffect(() => {
    if (emptiedByHide && hasNextPage && transportFault === null) void loadMore();
  }, [emptiedByHide, hasNextPage, transportFault, loadMore]);

  // A POST WHOLLY ON SCREEN JOINS HISTORY (History.md:5) — the card's own
  // post, never its author or tags. Attached at the list, so the card stays
  // the feed's (`seen-tracker.ts` says what counts and when it is sent).
  const listRef = useRef<HTMLUListElement>(null);
  const postIds = useMemo(() => shown.map((post) => post.id), [shown]);
  useSeenTracker({ root: host, list: listRef, ids: postIds, suspended: commentsOpen });
  // Where the drawn cards cross into the seen tail: the derive stands every
  // tail row after every unseen one, so the separator goes before the first
  // tail card drawn — and with nothing unseen, the feed opens at it.
  const seenFrom = useMemo(() => shown.findIndex((post) => seenTail.has(post.id)), [shown, seenTail]);

  return (
    // The band is chrome and full-bleed, so the gutter belongs to the content
    // below it rather than to the column that holds both.
    //
    // THE COLUMN HAS NO GAP OF ITS OWN (Feed: the band at the screen's top
    // edge, the first card 8px under it — `FeedList`'s `padding: 8px 0 0`,
    // which the collapsing region's own `pb-2` already is). A column gap
    // spent itself on the collapsing region's zero-height sentinel and on the
    // banners' slot while empty, dropping the band 16px and the list 32px.
    // The slots that hold something carry their own spacing instead.
    <main className="mx-auto flex w-full max-w-2xl flex-col pb-6">
      <CollapsingTop
        // Mirrors `scroll-pin.ts`'s own "nothing is anchored at the origin":
        // a restored offset of 0 is a top arrival, so the header stays. Read
        // from the same lazy-state source the restore itself reads, so this
        // and the actual landing offset can never disagree.
        initiallyHidden={rememberedPlace !== null && rememberedPlace.offset > 0}
        onBackToTop={goToTop}
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
          // The bell (FeedUnread.md): a signed-in reader's, an applicant's
          // included; a guest has no list and no bell (FeedBare.md:9).
          bell={
            phase === "signedIn"
              ? { lit: bellIsLit, onOpen: () => router.push(notificationsHref("feed")) }
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
          {/* Must-act, so it collapses into the header and follows the
              reader back up instead of living only at the top. It stands as
              the head of the list does (KeyElsewhere.jsx: first in `FeedList`,
              full width, 8px under the band), so it keeps no gutter. */}
          {phase === "signedIn" && keyOnDevice === false && !noKeyYet && (
            <div className="flex flex-col pt-2">
              <RestoreCard />
            </div>
          )}
        </CograBand>
      </CollapsingTop>
      {/* Empty, the slot is nothing at all to the layout; holding a banner,
          it keeps the 16px either side it always had. `StatusBanners` always
          renders its <section>, so `:empty` alone never matches a signed-in
          feed: the slot hides while every child is an empty section. */}
      <div className="flex flex-col gap-4 px-6 py-4 [&:not(:has(>:not(section:empty)))]:hidden">
        {/* The account-status banners ride the active tab (design.md §6). */}
        {phase === "signedIn" && <StatusBanners />}
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
        {!loading && transportFault === null && shown.length === 0 && !hasNextPage && (
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
          {/* What the wizard just did, if anything: a task card at the head of
              the list, full width like the posts under it (ComposeExpired).
              Dismissing drops the query value, so the notice cannot come
              back on a reload. */}
          {outcome !== null && (
            <li>
              <ComposeNotice onDismiss={() => router.replace("/feed", { scroll: false })} />
            </li>
          )}
          {shown.map((post, index) => (
            <Fragment key={post.id}>
              {index === seenFrom && <SeenSeparator />}
              {/* The card names itself to the pin: it is the anchor the
                  reader's place is measured against (`scroll-pin.ts`). One of
                  them also carries the watch that fetches the next page.
                  READING THE TAIL RECORDS NOTHING (FeedSeenTail.md): a card
                  under the separator never names itself to the seen tracker. */}
              <li
                {...{ [ANCHOR_ATTRIBUTE]: post.id }}
                {...(seenTail.has(post.id) ? {} : { [SEEN_ATTRIBUTE]: post.id })}
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
                  onLinkCopied={() => notify(LINK_COPIED)}
                  onOpenMenu={() => {
                    setMenuPost(post);
                    setMenuOpen(true);
                  }}
                  menuOpen={menuOpen && menuPost?.id === post.id}
                />
              </li>
            </Fragment>
          ))}
        </ul>
      </StageHost>
      <div className="flex flex-col gap-4 px-6 pt-4">
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
        {/* One region for the whole feed: a card that copied a link, and a
            menu row's aftermath, say so here rather than each card mounting a
            live region of its own. */}
        <Snackbar
          testId="feed-snackbar"
          node={{ path: "feed.snackbar" }}
          message={newer.message ?? snack?.message ?? null}
          action={newer.message !== null ? newer.action : snack?.action}
          token={newer.message !== null ? undefined : snack?.token}
          onDismiss={newer.message !== null ? newer.dismiss : dismissSnack}
        />
      </div>
      {/* THE CARDS' MENU, OVER THE FEED (FeedPostMenu.md). What its rows raise
          rises over the feed too — the license terms (:21) and the report's
          confirm (:23), registered as `feed.licenseSheet` and
          `feed.reportSheet` (FC-G10). */}
      <PostMenuHost
        post={menuPost}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        nodes={{
          sheet: { path: "feed.menuSheet" },
          row: feedMenuRow,
          licenseSheet: { path: "feed.licenseSheet" },
          reportSheet: { path: "feed.reportSheet" },
        }}
        testId="feed-menu"
        notify={notify}
        // THE CARD STANDS AS ITS MARK IN PLACE (RM-G9's build word): the feed
        // own menu's removal is undrawn, and "NEVER the post leaves without a
        // mark" (RemoveConfirm.md:11) holds here as on the detail. The
        // device's Removed filter is what cuts it, at its next re-derive.
        onRemoved={(removed) =>
          setPosts((current) => current.map((post) => (post.id === removed.id ? removed : post)))
        }
      />
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
