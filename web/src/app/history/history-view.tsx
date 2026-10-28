"use client";

// HISTORY — everything the reader has seen, as a feed (History.md,
// HistoryEmpty.md, HistoryFilter.md, HistoryNone.md, HistoryHidden.md,
// HistorySearch.md; design/designs/canonical/screens/History.jsx). Reached
// from the reader's own profile's ⋮, Saved's sibling.
//
// THE SEEN-LIST, AND NOTHING ELSE (History.md:3). A content joins it the first
// time it was fully in the viewport (the seen tracker, `seen-tracker.ts`), and
// the seeing stays in the app: it never becomes a graph record. The page
// surfaces exactly that list — append-only, never compacted, with no way to
// clear it and no way to take one thing out (History.md:45), because taking a
// thing out would put it back into the reader's feed.
//
// EVERY KIND AS ITS OWN FEED CARD (History.md:19-21): a post as the feed's
// `PostCard`, a comment as the `CommentFeedCard`, a person as the
// `ProfileFeedCard`, a topic as the `TagFeedCard` — unchanged and fully live.
// No card anatomy is this page's own, and no card wears the age of the seeing
// (History.md:31). A removed thing keeps its place wearing its card's own
// removal mark (History.md:39); sensitive content keeps its card's veil.
//
// NEWEST FIRST, BY FIRST SEEING, FROZEN PER OPEN (History.md:23, :109). The
// server pages on `(firstSeenAt, node id)`, so a thing first seen while the
// reader scrolls sorts above the open page and joins only at the next open or
// the next pull. A quiet day divider stands above the first thing seen on
// each day; it belongs to the list, never to a card.
//
// SEARCH AND FILTER ON TOP (History.md:85-107; HistoryFilter.md;
// HistorySearch.md): the one search law over the seen set, RUN ON THE SERVER
// (`viewHistory(query:)`), so a match is found wherever it stands, never only
// among the loaded cards; and the kinds trigger, whose sheet stages and whose
// Done re-reads once. A narrowed read stands in sections — people, then tags,
// then the content — each capped at three behind its door while another kind
// can stand beside it.
//
// A HIDDEN ACCOUNT'S POSTS AND COMMENTS STAY OUT WHILE IT IS HIDDEN, its own
// profile card stays (History.md:41) — the server's exclusion, and at every
// fresh read the device's own hidden set over what arrives, so a hide still on
// its way is honoured. The open History never rearranges under a hide
// (HistoryHidden.md:3-5): it takes hold at the next open or pull.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { CommentsSheet } from "@/app/comments/comments-sheet";
import type { PostView } from "@/lib/api/content-api";
import { fetchHistoryPage, type HistoryEntry, type HistoryPost } from "@/lib/api/history-api";
import { appendDeduped } from "@/lib/api/pagination";
import type { FeedKindValue } from "@/lib/feed/feed-filter";
import { useHiddenSet } from "@/lib/hidden/provider";
import type { HiddenSet } from "@/lib/hidden/hidden-set";
import {
  HISTORY_KINDS,
  dayNodeKey,
  dividersOf,
  kindsReading,
  nodeKindsOf,
  sectionOf,
} from "@/lib/history/history-list";
import { useHostSnack } from "@/lib/saved/save-row";
import { useAuthGuard } from "@/lib/session/runtime";
import { Button } from "@/lib/ui/button";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { CommentFeedCard } from "@/lib/ui/comment-feed-card";
import { EmptyState } from "@/lib/ui/empty-state";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { PageHeader } from "@/lib/ui/page-header";
import { PostCard } from "@/lib/ui/post-card";
import { ProfileFeedCard } from "@/lib/ui/profile-feed-card";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { scrollHostToTopAnimated, useScrollHost } from "@/lib/ui/scroll-host";
import { LINK_COPIED } from "@/lib/ui/share";
import { Snackbar } from "@/lib/ui/snackbar";
import { TagFeedCard } from "@/lib/ui/tag-feed-card";
import { TransportError } from "@/lib/ui/transport-error";
import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { Chip } from "@/lib/ui2/chip";
import { FilterFoot, FilterSection, FilterTrigger, triggerName } from "@/lib/ui2/filter-sheet";
import { StageHost } from "@/lib/ui2/media/stage-host";
import { PostMenuHost } from "@/lib/ui2/post-menu-host";
import { SearchBar } from "@/lib/ui2/search-bar";
import { SectionLabel } from "@/lib/ui2/section-label";

/** HistoryEmpty.md:3, verbatim. */
export const HISTORY_EMPTY = "Nothing here yet. Everything you see shows up here on its own, newest first.";

/** HistoryNone.md:3, verbatim — a query nothing seen carries. */
export const HISTORY_NONE_SEARCH =
  "Nothing you've seen carries that name. Search reads names and titles, never bodies — fewer words reach further.";

/** HistoryNone.md:5, verbatim — kinds that hold nothing seen. */
export const HISTORY_NONE_KINDS = "Nothing you've seen is of that kind.";

/** HistoryNone.md:9 — the empty state's one action. */
export const SHOW_EVERYTHING = "Show everything";

/** History.md:85: the field's placeholder and name, naming the list it searches. */
export const SEARCH_YOUR_HISTORY = "Search your history";

/** HistoryFilter.md:3: the sheet's title, and the trigger's purpose. */
export const WHAT_YOUR_HISTORY_SHOWS = "What your history shows";

/** HistoryFilter.jsx: the kinds section's hint, search's own words (copy-voice). */
export const KINDS_HINT = "Combine as many as you like. All, until you narrow it.";

/** HistorySearch.md:3, :11 — the sections' captions. */
export const PROFILES = "Profiles";
export const TAGS = "Tags";

/** HistorySearch.md:7, :15 — the sections' doors. */
export const SEE_ALL_PROFILES = "See all profiles";
export const SEE_ALL_TAGS = "See all tags";

/** The chronicle's load-more fault (design digest item 57), as Saved's. */
export const COULDNT_LOAD_MORE = "Couldn't load more";

/** How long the field waits for typing to settle before History narrows. */
export const HISTORY_SEARCH_DEBOUNCE_MS = 250;

/** Where a card's doors say the reader came from: `Back to History`. */
const FROM = "history";

type Entry = HistoryEntry & { readonly id: string };

/** What one read asked: the query and the kinds it narrowed by. */
type Ask = { readonly query: string; readonly kinds: readonly FeedKindValue[] };

function sameKinds(a: readonly FeedKindValue[], b: readonly FeedKindValue[]): boolean {
  return a.length === b.length && a.every((kind) => b.includes(kind));
}

function sameAsk(a: Ask | null, b: Ask): boolean {
  return a !== null && a.query === b.query && sameKinds(a.kinds, b.kinds);
}

/** The kinds History stands as cards; a kind a later slice adds waits for its card. */
function isCardKind(entry: HistoryEntry): boolean {
  const kind = entry.node.__typename;
  return kind === "Post" || kind === "Comment" || kind === "User" || kind === "Hashtag";
}

/**
 * Whom a seen thing is by — a post's or a comment's author — for the hidden
 * set. A person and a topic are by no one: a hidden account's own profile card
 * stays (History.md:41).
 */
function authorOf(entry: HistoryEntry): string | null {
  const node = entry.node;
  if (node.__typename === "Post" || node.__typename === "Comment") return node.author?.id ?? null;
  return null;
}

/**
 * What a fresh read stands: every card kind, less a hidden account's posts and
 * comments — unless a hide or its Undo made from that very card did not go
 * through, when the card stands carrying its line (HistoryHidden.md:11).
 */
function entriesOf(items: readonly HistoryEntry[], hidden: HiddenSet | null): Entry[] {
  return items
    .filter(isCardKind)
    .filter((entry) => {
      if (hidden === null) return true;
      const author = authorOf(entry);
      return author === null || !hidden.has(author) || hidden.failure(entry.node.id) !== null;
    })
    .map((entry) => ({ ...entry, id: entry.node.id }));
}

export function HistoryScreen({
  searchDebounceMs = HISTORY_SEARCH_DEBOUNCE_MS,
}: {
  /** Test injection — how long the field waits for typing to settle. */
  searchDebounceMs?: number;
} = {}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const host = useScrollHost();
  const hidden = useHiddenSet();
  const { snack, notify, dismiss } = useHostSnack();

  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasMorePeople, setHasMorePeople] = useState(false);
  const [hasMoreTags, setHasMoreTags] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  // What the reader typed, the kinds the filter holds, and what the list on
  // screen answers — null until the first read lands. They differ while
  // typing settles and while a narrowed read is on its way.
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<readonly FeedKindValue[]>([]);
  const [listAsk, setListAsk] = useState<Ask | null>(null);
  // The filter sheet's staged kinds, taken when it opens (HistoryFilter.md:15).
  const [sheetOpen, setSheetOpen] = useState(false);
  const [staged, setStaged] = useState<readonly FeedKindValue[]>([]);
  // THE APPLY IS SAID ONCE (FeedFilter.jsx, the K13 round; WCAG 4.1.3).
  const [said, setSaid] = useState("");
  // The feed's own two hosted sheets: a post card's menu, and the thread its
  // comment count raises — over this page, as over the feed.
  const [menuPost, setMenuPost] = useState<PostView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsPost, setCommentsPost] = useState<PostView | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liveComments, setLiveComments] = useState<{ id: string; total: number } | null>(null);
  // Which read is live: a pull, a new query or new kinds fire a new one, and
  // an older one resolving afterwards must not overwrite it.
  const request = useRef(0);
  // What the list on screen answers, for the reads that continue it.
  const listAskRef = useRef<Ask | null>(null);

  /** The first page of History, narrowed as `ask` says. */
  const read = useCallback(
    (ask: Ask) => {
      const mine = (request.current += 1);
      void (async () => {
        // EVERY OPEN AND EVERY PULL READS THE HIDDEN SET AGAIN, beside the
        // page (the feed's rule, hidden-actors packet §5.1): a hide made on
        // another device reaches this one, and a fresh load is the moment a
        // card's failed-hide line goes (HistoryHidden.md:11). The server
        // already keeps a hidden account's things out, so a set that could
        // not be read leaves the page as served rather than failing it.
        const [outcome] = await Promise.all([
          guard.run(() => fetchHistoryPage(client, null, ask.query, nodeKindsOf(ask.kinds))),
          hidden.refetch(),
        ]);
        if (mine !== request.current) return;
        setLoading(false);
        if (outcome.kind !== "success") {
          setFailed(true);
          // A FAILED REFRESH keeps the cards on screen; a failed NEW NARROWING
          // must not leave another narrowing's cards standing as its answer.
          if (!sameAsk(listAskRef.current, ask)) {
            listAskRef.current = ask;
            setListAsk(ask);
            setEntries([]);
            setEndCursor(null);
            setHasNextPage(false);
            setHasMorePeople(false);
            setHasMoreTags(false);
          }
          return;
        }
        listAskRef.current = ask;
        setListAsk(ask);
        setFailed(false);
        setMoreFailed(false);
        setEntries(entriesOf(outcome.value.items, hidden));
        setEndCursor(outcome.value.endCursor);
        setHasNextPage(outcome.value.hasNextPage);
        setHasMorePeople(outcome.value.hasMorePeople);
        setHasMoreTags(outcome.value.hasMoreTags);
      })();
    },
    [client, guard, hidden],
  );

  // THE FIELD NARROWS ONCE TYPING SETTLES (Saved's debounce shape): every
  // keystroke would otherwise be a read, and only the last one's answer could
  // ever stand. A cleared field, and a change of kinds, ask at once. The
  // first arrival is this same read, whole.
  const asked = query.trim();
  const ask = useMemo<Ask>(() => ({ query: asked, kinds }), [asked, kinds]);
  const arrived = useRef(false);
  const lastQuery = useRef(asked);
  useEffect(() => {
    const typed = arrived.current && asked !== "" && asked !== lastQuery.current;
    arrived.current = true;
    lastQuery.current = asked;
    const timer = setTimeout(() => read(ask), typed ? searchDebounceMs : 0);
    return () => {
      clearTimeout(timer);
      request.current += 1;
    };
  }, [ask, asked, read, searchDebounceMs]);

  // PULL DOWN AT THE TOP RE-READS (History.md:111): the platform's own
  // refresh, through the same read the first arrival takes.
  const onPull = useCallback(() => {
    setLoading(true);
    read(ask);
  }, [read, ask]);
  usePullToRefresh({ host, onPull });

  // THE NEXT PAGE OF THE SAME LIST: a narrowed list pages on cursors of its
  // own, so the next page carries the narrowing its first page answered.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage || endCursor === null) return;
    const continued = listAskRef.current ?? { query: "", kinds: [] };
    const mine = request.current;
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await guard.run(() =>
      fetchHistoryPage(client, endCursor, continued.query, nodeKindsOf(continued.kinds)),
    );
    setLoadingMore(false);
    if (mine !== request.current) return;
    if (outcome.kind !== "success") {
      // THE CARDS ON SCREEN STAY, and the fault ends the list.
      setMoreFailed(true);
      return;
    }
    // A next page never filters what already stands: only what arrives.
    setEntries((current) => appendDeduped(current, entriesOf(outcome.value.items, hidden)));
    setEndCursor(outcome.value.endCursor);
    setHasNextPage(outcome.value.hasNextPage);
  }, [client, guard, hidden, loadingMore, hasNextPage, endCursor]);

  const tailRef = useApproachingTail({
    root: host,
    onReach: loadMore,
    enabled: hasNextPage && !moreFailed,
  });
  const tailIndex = tailIndexOf(entries.length);

  const searching = asked !== "";
  const narrowedByQuery = listAsk !== null && listAsk.query !== "";
  const narrowedByKinds = listAsk !== null && listAsk.kinds.length > 0;
  const nothingShown = !loading && !failed && entries.length === 0 && !hasNextPage && !loadingMore;
  // HISTORYEMPTY is the whole list holding nothing — the reader has seen
  // nothing yet — and draws no field and no trigger (HistoryEmpty.md:7).
  const empty = nothingShown && !narrowedByQuery && !narrowedByKinds && !searching && kinds.length === 0;
  // HISTORYNONE is the reader's own narrowing holding nothing: a query
  // (HistoryNone.md:3) or, with no query, the kinds (HistoryNone.md:5).
  const none = nothingShown && !empty && (narrowedByQuery || narrowedByKinds);
  const fielded = !empty && listAsk !== null;
  const reading = kindsReading(kinds);

  // SECTIONS, ONLY UNDER A QUERY (HistorySearch.md:3-23, :35): the people
  // first, then the tags, then the content, in the order served. A kind
  // narrowed alone stands without its caption and its door.
  const peopleAlone = narrowedByQuery && listAsk !== null && sameKinds(listAsk.kinds, ["profiles"]);
  const tagsAlone = narrowedByQuery && listAsk !== null && sameKinds(listAsk.kinds, ["topics"]);
  const people = narrowedByQuery ? entries.filter((entry) => sectionOf(entry.node.__typename) === "people") : [];
  const tags = narrowedByQuery ? entries.filter((entry) => sectionOf(entry.node.__typename) === "tags") : [];
  const content = narrowedByQuery
    ? entries.filter((entry) => sectionOf(entry.node.__typename) === "content")
    : entries;
  // DAY DIVIDERS BELONG TO THE WHOLE LIST: under a query the sections break
  // the one chronological column, and the board draws none there.
  const dividers = narrowedByQuery ? content.map(() => null) : dividersOf(content.map((entry) => entry.firstSeenAt));

  const openSheet = () => {
    setStaged(kinds);
    setSheetOpen(true);
  };
  const commit = () => {
    setSheetOpen(false);
    setSaid(triggerName(kindsReading(staged), WHAT_YOUR_HISTORY_SHOWS));
    setLoading(true);
    // Done re-reads once with the staged kinds (HistoryFilter.md:17).
    if (sameKinds(staged, kinds)) read({ query: asked, kinds });
    else setKinds(staged);
  };
  // A DOOR NARROWS TO ITS KIND ALONE and keeps the query (HistorySearch.md:19, :27).
  const narrowTo = (kind: FeedKindValue) => {
    setLoading(true);
    setKinds([kind]);
  };
  const showEverything = () => {
    setQuery("");
    setKinds([]);
  };

  // The tail is watched on the approaching end of the list as served: the
  // sections keep the served order, so one index counts across them.
  const renderEntry = (entry: Entry) => (
    <li key={entry.id} data-history-id={entry.id} ref={entries.indexOf(entry) === tailIndex ? tailRef : undefined}>
      <HistoryCard
        entry={entry}
        notify={notify}
        comments={(post) => (liveComments?.id === post.id ? liveComments.total : post.comments.totalCount)}
        onOpenComments={(post) => {
          setCommentsPost(post);
          setCommentsOpen(true);
        }}
        onOpenMenu={(post) => {
          setMenuPost(post);
          setMenuOpen(true);
        }}
        menuOpenFor={menuOpen ? (menuPost?.id ?? null) : null}
      />
    </li>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col">
      <span role="status" aria-live="polite" className="sr-only">
        {said}
      </span>
      {/* THE HEADER, THE FIELD AND THE TRIGGER COLLAPSE ON THE WAY DOWN AND
          RETURN ON THE WAY UP (History.md:119), and a reader three screens
          down summons Back to top with them; its tap goes up, animated, and
          never re-reads (History.md:113-117). */}
      <CollapsingTop onBackToTop={() => scrollHostToTopAnimated(host)}>
        <PageHeader
          title="History"
          backHref="/profile"
          backLabel="Back to your profile"
          backScroll={false}
          backTestId="history-back"
          node={{ path: "history.header" }}
        />
        {fielded && (
          <div className="flex-none">
            <SearchBar
              query={query}
              onChange={setQuery}
              placeholder={SEARCH_YOUR_HISTORY}
              ariaLabel={SEARCH_YOUR_HISTORY}
              node={{ path: "history.searchField" }}
            />
            <div className="flex items-center px-4 pb-2">
              <FilterTrigger
                reading={reading}
                purpose={WHAT_YOUR_HISTORY_SHOWS}
                expanded={sheetOpen}
                onOpen={openSheet}
                node={{ path: "history.filterTrigger" }}
              />
            </div>
          </div>
        )}
      </CollapsingTop>
      {loading && entries.length === 0 && (
        <p role="status" aria-live="polite" data-testid="history-loading" className="px-4 pt-2">
          Loading…
        </p>
      )}
      {failed && entries.length === 0 && !loading && (
        <div className="flex items-center gap-3 px-4 pt-2">
          <TransportError testId="history-transport-error" />
          <Button
            testId="history-retry"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              read(ask);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {empty && (
        // HISTORYEMPTY: words only — no action button, no error colour.
        <div className="px-6 pt-2">
          <EmptyState testId="history-empty" node={{ path: "history.empty" }} title={HISTORY_EMPTY} />
        </div>
      )}
      {none && (
        // HISTORYNONE: the field keeps the query and the trigger its reading;
        // the one way back clears both (HistoryNone.md:7-13).
        <div className="px-6 pt-2">
          <EmptyState
            testId="history-empty"
            node={{ path: "history.empty" }}
            title={narrowedByQuery ? HISTORY_NONE_SEARCH : HISTORY_NONE_KINDS}
            actionLabel={SHOW_EVERYTHING}
            onAction={showEverything}
          />
        </div>
      )}
      {entries.length > 0 && (
        // THE FEED'S ONE STAGE (History.md:77-83): at most one clip plays, and
        // the stage re-elects at the list's hard top, by the feed's law.
        <StageHost>
          <div data-testid="history-list" className="flex flex-col pt-2">
            {people.length > 0 && (
              <>
                {!peopleAlone && (
                  <SectionLabel node={{ path: "history.profilesLabel" }}>{PROFILES}</SectionLabel>
                )}
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {people.map((entry) => renderEntry(entry))}
                </ul>
                {!peopleAlone && hasMorePeople && (
                  <div className="flex px-2 pt-2">
                    <Button
                      testId="history-profiles-door"
                      node={{ path: "history.profilesDoor" }}
                      variant="text"
                      size="sm"
                      onClick={() => narrowTo("profiles")}
                    >
                      {SEE_ALL_PROFILES}
                    </Button>
                  </div>
                )}
              </>
            )}
            {tags.length > 0 && (
              <>
                {!tagsAlone && <SectionLabel node={{ path: "history.tagsLabel" }}>{TAGS}</SectionLabel>}
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {tags.map((entry) => renderEntry(entry))}
                </ul>
                {!tagsAlone && hasMoreTags && (
                  <div className="flex px-2 pt-2">
                    <Button
                      testId="history-tags-door"
                      node={{ path: "history.tagsDoor" }}
                      variant="text"
                      size="sm"
                      onClick={() => narrowTo("topics")}
                    >
                      {SEE_ALL_TAGS}
                    </Button>
                  </div>
                )}
              </>
            )}
            {content.length > 0 && (
              // THE CONTENT TAKES NO CAPTION OF ITS OWN (HistorySearch.md:23).
              <ul
                className={`m-0 flex list-none flex-col gap-2 p-0 ${people.length + tags.length > 0 ? "pt-2" : ""}`}
              >
                {content.map((entry, index) => {
                  const day = dividers[index];
                  return (
                    <Fragment key={entry.id}>
                      {day !== null && day !== undefined && (
                        // A QUIET DAY DIVIDER (History.md:25-27): label-small,
                        // secondary, centred, no rule and no fill — part of
                        // the list, never of a card.
                        <li
                          role="heading"
                          aria-level={2}
                          data-testid="history.day"
                          data-testid-key={dayNodeKey(day)}
                          className="self-center py-1 text-label-small text-on-surface-variant"
                        >
                          {day}
                        </li>
                      )}
                      {renderEntry(entry)}
                    </Fragment>
                  );
                })}
              </ul>
            )}
          </div>
        </StageHost>
      )}
      {moreFailed && (
        <div className="flex items-center gap-3 px-4 pt-3" role="alert">
          <span className="text-body-medium text-error" data-testid="history-more-failed">
            {COULDNT_LOAD_MORE}
          </span>
          <Button testId="history-more-retry" variant="text" size="sm" onClick={() => void loadMore()}>
            Retry
          </Button>
        </div>
      )}
      {loadingMore && (
        <p role="status" aria-live="polite" data-testid="history-loading-more" className="px-4 pt-3">
          Loading…
        </p>
      )}
      <Snackbar
        testId="history-snackbar"
        node={{ path: "history.snackbar" }}
        message={snack?.message ?? null}
        action={snack?.action}
        token={snack?.token}
        onDismiss={dismiss}
      />
      {/* THE HISTORY'S FILTER SHEET (HistoryFilter.md): kinds and only kinds,
          no "?", Reset in the corner and Done at the end. It stages; the
          scrim, a swipe down, Back and Escape drop what it staged. */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={WHAT_YOUR_HISTORY_SHOWS}
        testId="history-filter-sheet"
        node={{ path: "history.filterSheet" }}
        foot={
          <FilterFoot
            onReset={() => setStaged([])}
            onDone={commit}
            node={{ path: "history.filterSheet.foot" }}
          />
        }
      >
        <FilterSection label="Kinds" hint={KINDS_HINT} node={{ path: "history.filterSheet.kinds" }}>
          {HISTORY_KINDS.map((kind) => (
            <Chip
              key={kind.value}
              testId={`history-filter-${kind.value}`}
              node={{ path: `history.filterSheet.kinds.${kind.value}Chip` }}
              selected={staged.includes(kind.value)}
              onClick={() =>
                setStaged((current) =>
                  current.includes(kind.value)
                    ? current.filter((value) => value !== kind.value)
                    : [...current, kind.value],
                )
              }
            >
              {kind.label}
            </Chip>
          ))}
        </FilterSection>
      </BottomSheet>
      {/* A POST CARD'S MENU, OVER HISTORY: the reader's menu every post card
          opens, its Hide's aftermath on this page's snackbar (HistoryHidden.md:3). */}
      <PostMenuHost
        post={menuPost}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        testId="history-menu"
        notify={notify}
      />
      {commentsPost !== null && (
        <CommentsSheet
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
          post={commentsPost}
          onCount={(total) => setLiveComments({ id: commentsPost.id, total })}
        />
      )}
    </main>
  );
}

/** One seen thing, as its kind's own feed card. */
function HistoryCard({
  entry,
  notify,
  comments,
  onOpenComments,
  onOpenMenu,
  menuOpenFor,
}: {
  entry: Entry;
  notify: ReturnType<typeof useHostSnack>["notify"];
  comments: (post: HistoryPost) => number;
  onOpenComments: (post: HistoryPost) => void;
  onOpenMenu: (post: HistoryPost) => void;
  menuOpenFor: string | null;
}) {
  const node = entry.node;
  const copied = () => notify(LINK_COPIED);
  switch (node.__typename) {
    case "Post":
      return (
        <PostCard
          post={node}
          // Each card keeps its kind's own name on the page (History.jsx),
          // keyed by the record's own identity, as the feed keys its cards.
          node={{ path: "history.card", key: node.id }}
          href={`/posts/${node.id}?from=${FROM}`}
          shareHref={`/posts/${node.id}`}
          testId={`history-post-${node.id}`}
          authorTestId={`history-author-${node.id}`}
          stanceTestId={`history-stance-${node.id}`}
          comments={comments(node)}
          onOpenComments={() => onOpenComments(node)}
          onLinkCopied={copied}
          onOpenMenu={() => onOpenMenu(node)}
          menuOpen={menuOpenFor === node.id}
        />
      );
    case "Comment":
      return (
        <CommentFeedCard
          comment={node}
          from={FROM}
          node={{ path: "history.commentCard", key: node.id }}
          testId={`history-comment-${node.id}`}
          onNotify={notify}
          onLinkCopied={copied}
        />
      );
    case "User":
      return (
        <ProfileFeedCard
          person={node}
          href={`/u/${node.handle}?from=${FROM}`}
          node={{ path: "history.profileCard", key: node.id }}
          testId={`history-person-${node.id}`}
          onNotify={notify}
          onLinkCopied={copied}
        />
      );
    case "Hashtag":
      return (
        <TagFeedCard
          topic={node}
          from={FROM}
          node={{ path: "history.tagCard", key: node.id }}
          testId={`history-tag-${node.id}`}
          onLinkCopied={copied}
        />
      );
    default:
      return null;
  }
}
