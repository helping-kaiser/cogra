"use client";

// EXPLORE — the bar's search slot, the surface slice 2.7 draws over the one
// search law (Explore.md, ExploreSearch.md, ExploreFilter.md, ExploreNone.md,
// ExploreUnscoped.md, ExplorePerson.md; design/designs/canonical/screens/
// Explore*.jsx; api-spec.md "Search").
//
// AT REST it reads the field under the band, the Sky's card, the door into
// Your topics, then Recent (Explore.md:3). TYPING TAKES THE SCREEN: the band
// gives way to the field, the worded trigger and the "?" stand under it, and
// the results refine as the reader types (ExploreSearch.md:3). SEARCHING IS A
// STATE OF THIS ROOT, never a screen of its own (Explore.md:9): the trailing ×,
// emptying the field and the browser's Back each bring the root back to rest,
// and Back never leaves Explore from a standing search (:13-17).
//
// THE ANSWER IS DRAWN AS SERVED (`results.ts`). Nothing on this page marks
// anything seen: a result counts as seen only once it is opened, on the
// surface it opens (ExploreFilter.md:39).
//
// THE WAY BACK FINDS IT AS IT WAS (Explore.md:19): a result opens with
// `from=search`, its back arrow reads `Back to the search`, and this root comes
// back with the query, the filter, the rows and the scroll it was left with —
// kept in memory for the page load (`exploreMemory`), and the query also in the
// URL (`?q=`), the browser's own restore for a reload (readme §13, *A process
// the OS ended in the background restores*).
//
// BETWEEN A KEYSTROKE AND ITS ANSWER the rows on screen stay readable; only a
// refine still unanswered 200ms after it was asked shows `Loading…`, by the
// loading ladder (ExploreSearch.md:55-57). A failed refine keeps the rows
// under `Couldn't load more` with Retry at their head; a failed read with
// nothing loaded says the house line with Retry in the results' place
// (:59-63). Two refines in flight never cross: only the newest one's answer
// reaches the screen.

import { useApolloClient } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { FeedKindValue } from "@/lib/feed/feed-filter";
import { fetchSearchPage, type SearchHit } from "@/lib/api/search-api";
import { appendDeduped } from "@/lib/api/pagination";
import { firstArrival, useBellLit, useFreshRootBell } from "@/lib/notifications/bell";
import { notificationsHref } from "@/lib/notifications/origin";
import { recentNodeKey, useRecents } from "@/lib/search/recents";
import {
  layoutResults,
  onlyUnscopedComments,
  unscopedComments,
  FOUND_THROUGH_PEOPLE_AND_TAGS,
  NOTHING_CARRIES_THAT_NAME,
  PROFILES_LABEL,
  SEE_ALL_PROFILES,
  BEYOND_YOUR_REACH,
  type ResultItem,
} from "@/lib/search/results";
import {
  guestSearchFilter,
  readCommittedFilter,
  readerSearchDefault,
  sameSearchFilter,
  searchFilterSummary,
  toggleKind,
  wireKinds,
  wireOrder,
  writeCommittedFilter,
  SEARCH_KINDS,
  SEARCH_ORDERS,
  type SearchFilterValue,
} from "@/lib/search/search-filter";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { CograBand } from "@/lib/ui/cogra-band";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { EmptyState } from "@/lib/ui/empty-state";
import { Icon } from "@/lib/ui/icons";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { scrollHostTo, scrollOffsetOf, useScrollHost } from "@/lib/ui/scroll-host";
import { TransportError } from "@/lib/ui/transport-error";
import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { Chip } from "@/lib/ui2/chip";
import { ContentRow } from "@/lib/ui2/content-row";
import { FilterFoot, FilterSection, OrderSection } from "@/lib/ui2/filter-section";
import { FilterTrigger, triggerName } from "@/lib/ui2/filter-trigger";
import { HelpDialog, HELP_TOPICS } from "@/lib/ui2/help-dialog";
import { HelpDot } from "@/lib/ui2/help-dot";
import { ReferenceRow } from "@/lib/ui2/reference-row";
import { SearchBar } from "@/lib/ui2/search-bar";
import { SectionLabel } from "@/lib/ui2/section-label";

/** The field's placeholder (Explore.jsx; copy-voice, Explore's carried-over words). */
export const EXPLORE_PLACEHOLDER = "Search people, posts, tags…";

/** The field's name (SearchBar.jsx: `Search` on Explore). */
export const EXPLORE_FIELD_NAME = "Search";

/** The Sky's card (Explore.jsx; Explore.md:5). */
export const SKY_TITLE = "The Sky — coming soon";
export const SKY_DESCRIPTION = "Your sky — every account a star, sized by your own paths to it.";

/** The trigger's and the sheet's purpose (ExploreSearch.md:19; ExploreFilter.jsx). */
export const WHAT_THE_SEARCH_SHOWS = "What the search shows";

/** The results' "?" and the sheet's (copy-voice, *A "?" is named by the dialog it opens*). */
export const HOW_SEARCHING_WORKS = "How searching works";
export const HOW_THE_FILTER_WORKS = "How the filter works";

/** The kinds section's words (ExploreFilter.jsx). */
export const KINDS_HINT = "Combine as many as you like. All, until you narrow it.";

/** The load-more fault (copy-voice; design digest item 27). */
export const COULDNT_LOAD_MORE = "Couldn't load more";

/** How long the field waits for typing to settle before the search refines. */
export const EXPLORE_SEARCH_DEBOUNCE_MS = 250;

/** The loading ladder's quiet window (design/readme.md, *Loading*). */
export const LOADING_LADDER_MS = 200;

const NODE = "explore";
const node = (path: string): DataNode => ({ path: `${NODE}.${path}` });

type Results = {
  readonly hits: readonly SearchHit[];
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
  readonly hasMorePeople: boolean;
  /** The query and filter these rows answer. */
  readonly query: string;
  readonly filter: SearchFilterValue;
};

const NO_RESULTS: Results = {
  hits: [],
  endCursor: null,
  hasNextPage: false,
  hasMorePeople: false,
  query: "",
  filter: readerSearchDefault(),
};

/**
 * THE ROOT AS IT WAS LEFT (Explore.md:19; BottomNav.jsx: another tab returns
 * in the state it was left), for the length of the page load and for one
 * reader — a sign-out or another account starts fresh.
 */
type ExploreMemory = {
  readonly reader: string | null;
  readonly query: string;
  readonly filter: SearchFilterValue;
  readonly results: Results | null;
  readonly scroll: number;
};

let exploreMemory: ExploreMemory | null = null;

/** Test seam. */
export function resetExploreMemory(): void {
  exploreMemory = null;
}

function searchUrl(query: string): string {
  return query === "" ? "/explore" : `/explore?q=${encodeURIComponent(query)}`;
}

export function ExploreView({
  initialQuery = null,
  debounceMs = EXPLORE_SEARCH_DEBOUNCE_MS,
  now,
}: {
  /** The URL's `?q=` — a reload's query. */
  initialQuery?: string | null;
  /** Test injection. */
  debounceMs?: number;
  /** Test injection: the clock the ages read. */
  now?: number;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const host = useScrollHost();
  const phase = useAuthPhase();
  const account = useActiveAccountId();
  // THE READER — a guest has none; an applicant reads as a member (Explore.md:39).
  const reader = phase === "signedIn" ? account : null;
  const guest = phase === "signedOut";

  const [remembered] = useState(() => {
    const kept = exploreMemory;
    if (kept === null || kept.reader !== reader) return null;
    if (initialQuery !== null && initialQuery !== kept.query) return null;
    return kept;
  });

  // WHOSE FILTER THIS IS. The phase resolves after the first paint, and with
  // it the filter: the account's committed one, or a guest's — newest, with
  // no seen toggle (ExploreSearch.md:65; ExploreFilter.md:41). A filter the
  // reader chose here belongs to whoever chose it, so a change of reader
  // falls back to that reader's own (React's "adjusting state when a prop
  // changes", derived rather than synced in an effect).
  const resolved = phase !== "resolving";
  const who = !resolved ? "" : guest ? "guest" : (reader ?? "guest");
  const committedDefault = useMemo(
    (): SearchFilterValue =>
      guest ? guestSearchFilter(readCommittedFilter(null)?.kinds ?? []) : (readCommittedFilter(reader) ?? readerSearchDefault()),
    // Read once per reader: the committed filter changes only through `commit`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [who],
  );
  const [chosen, setChosen] = useState<{ readonly who: string; readonly value: SearchFilterValue } | null>(
    remembered === null ? null : { who, value: remembered.filter },
  );
  const filter = chosen !== null && chosen.who === who ? chosen.value : committedDefault;

  const [query, setQuery] = useState(remembered?.query ?? initialQuery ?? "");
  const [results, setResults] = useState<Results | null>(remembered?.results ?? null);
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [staged, setStaged] = useState<SearchFilterValue>(filter);
  const [searchHelp, setSearchHelp] = useState(false);
  const [filterHelp, setFilterHelp] = useState(false);
  const [joinPrompt, setJoinPrompt] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [recents, remember] = useRecents(guest ? null : reader);

  const asked = query.trim();
  const searching = asked !== "";

  // THE BELL ON THIS ROOT (FeedUnread.md:3, :9): lit only on its fresh load.
  const [freshRoot] = useState(() => firstArrival(reader, "explore"));
  useFreshRootBell(reader, freshRoot);
  const bellIsLit = useBellLit(reader);

  // Which read is live: only the newest ask's answer reaches the screen.
  const request = useRef(0);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const read = useCallback(
    (text: string, value: SearchFilterValue) => {
      const mine = (request.current += 1);
      if (slowTimer.current !== null) clearTimeout(slowTimer.current);
      setMoreFailed(false);
      if (text === "") {
        setPending(false);
        setSlow(false);
        setFailed(false);
        return;
      }
      // Comments alone and no cue: nothing can stand, the line says the way
      // (ExploreUnscoped.md:3-5) — no read is sent for an answer known empty.
      if (onlyUnscopedComments(text, value.kinds)) {
        setPending(false);
        setSlow(false);
        setFailed(false);
        setResults({ ...NO_RESULTS, query: text, filter: value });
        return;
      }
      setPending(true);
      setSlow(false);
      slowTimer.current = setTimeout(() => {
        if (mine === request.current) setSlow(true);
      }, LOADING_LADDER_MS);
      void (async () => {
        const outcome = await guard.run(() =>
          fetchSearchPage(
            client,
            {
              query: text,
              kinds: wireKinds(value.kinds),
              includeSeen: guest ? true : value.seen,
              order: wireOrder(value.order),
              viewer: reader,
            },
            null,
          ),
        );
        if (mine !== request.current) return;
        if (slowTimer.current !== null) clearTimeout(slowTimer.current);
        setPending(false);
        setSlow(false);
        if (outcome.kind !== "success") {
          setFailed(true);
          return;
        }
        setFailed(false);
        setResults({
          hits: outcome.value.hits,
          endCursor: outcome.value.endCursor,
          hasNextPage: outcome.value.hasNextPage,
          hasMorePeople: outcome.value.hasMorePeople,
          query: text,
          filter: value,
        });
      })();
    },
    [client, guard, guest, reader],
  );

  // THE RESULTS REFINE AS THE READER TYPES (ExploreSearch.md:3), once typing
  // settles; a new filter asks at once. A restored root whose rows already
  // answer its query asks nothing (a restore is not a refine).
  const askedFilter = useRef<SearchFilterValue | null>(null);
  const restored = useRef(remembered?.results != null && remembered.results.query === asked);
  useEffect(() => {
    // Nothing is asked before the phase says who is asking.
    if (!resolved) return;
    if (restored.current) {
      restored.current = false;
      askedFilter.current = filter;
      return;
    }
    const filterChanged = askedFilter.current !== null && !sameSearchFilter(askedFilter.current, filter);
    askedFilter.current = filter;
    const wait = asked === "" || filterChanged ? 0 : debounceMs;
    const timer = setTimeout(() => read(asked, filter), wait);
    return () => clearTimeout(timer);
  }, [asked, filter, read, debounceMs, resolved]);

  // Unmounting drops whatever is still in flight.
  useEffect(
    () => () => {
      request.current += 1;
      if (slowTimer.current !== null) clearTimeout(slowTimer.current);
    },
    [],
  );

  // THE NEXT PAGE OF THE SAME ASK.
  const loadMore = useCallback(async () => {
    if (results === null || loadingMore || !results.hasNextPage || results.endCursor === null) return;
    const mine = request.current;
    const answering = results;
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await guard.run(() =>
      fetchSearchPage(
        client,
        {
          query: answering.query,
          kinds: wireKinds(answering.filter.kinds),
          includeSeen: guest ? true : answering.filter.seen,
          order: wireOrder(answering.filter.order),
          viewer: reader,
        },
        answering.endCursor,
      ),
    );
    setLoadingMore(false);
    if (mine !== request.current) return;
    if (outcome.kind !== "success") {
      setMoreFailed(true);
      return;
    }
    setResults((current) =>
      current === null
        ? current
        : {
            ...current,
            hits: appendDeduped(
              current.hits.map((hit) => ({ ...hit, id: hit.node.id })),
              outcome.value.hits.map((hit) => ({ ...hit, id: hit.node.id })),
            ),
            endCursor: outcome.value.endCursor,
            hasNextPage: outcome.value.hasNextPage,
          },
    );
  }, [client, guard, guest, loadingMore, reader, results]);

  // THE QUERY RIDES THE URL (readme §13, *A process … restores*): entering a
  // search adds one history entry, so the browser's Back from a standing
  // search comes back to rest and never leaves Explore (Explore.md:15); each
  // keystroke after it replaces that entry rather than adding one.
  const pushed = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const inUrl = new URLSearchParams(window.location.search).get("q") ?? "";
    if (inUrl === query) return;
    if (query !== "" && inUrl === "" && !pushed.current) {
      window.history.pushState(null, "", searchUrl(query));
      pushed.current = true;
    } else {
      window.history.replaceState(null, "", searchUrl(query));
    }
  }, [query]);
  useEffect(() => {
    const onPop = () => {
      const inUrl = new URLSearchParams(window.location.search).get("q") ?? "";
      pushed.current = false;
      if (inUrl === "") setQuery("");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** Back to rest (Explore.md:13, :17): the field empties. */
  const toRest = useCallback(() => {
    setQuery("");
    if (pushed.current) {
      pushed.current = false;
      // The entry the search added goes with it, so the next Back leaves
      // Explore as it would from rest.
      window.history.back();
    }
  }, []);

  const onChange = useCallback(
    (next: string) => {
      if (next.trim() === "" && asked !== "") {
        toRest();
        return;
      }
      setQuery(next);
    },
    [asked, toRest],
  );

  // THE ROOT AS IT WAS LEFT, kept as it changes and the scroll at leaving.
  const live = useRef<ExploreMemory | null>(null);
  useEffect(() => {
    live.current = { reader, query, filter, results, scroll: 0 };
  });
  useLayoutEffect(() => {
    if (remembered !== null && remembered.scroll > 0) scrollHostTo(host, remembered.scroll);
    return () => {
      if (live.current !== null) exploreMemory = { ...live.current, scroll: scrollOffsetOf(host) };
    };
    // Mount and unmount only: the restore runs once, the save at leaving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SEARCH RESULTS TAKE THE PULL-DOWN; Explore at rest takes none
  // (Explore.md:45; readme §13's pull-down list).
  const onPull = useCallback(() => read(asked, filter), [read, asked, filter]);
  usePullToRefresh({ host, onPull, enabled: searching && !sheetOpen });

  // THE COMMITTED FILTER (ExploreFilter.md:33): Done closes the sheet and
  // re-queries once, and the filter is kept on this device.
  const commit = useCallback(
    (next: SearchFilterValue) => {
      setChosen({ who, value: next });
      writeCommittedFilter(guest ? null : reader, next);
    },
    [guest, reader, who],
  );

  const defaultFilter = guest ? guestSearchFilter() : readerSearchDefault();
  const reading = searchFilterSummary(filter, defaultFilter);

  const items: ResultItem[] = useMemo(
    () =>
      results === null
        ? []
        : layoutResults({
            query: results.query,
            hits: results.hits,
            kinds: results.filter.kinds,
            order: guest ? "newest" : results.filter.order,
            hasMorePeople: results.hasMorePeople,
            reader,
            now,
          }),
    [results, guest, reader, now],
  );
  const rowCount = items.filter((item) => item.type === "row").length;
  const tailRef = useApproachingTail({
    root: host,
    // The watch is rebuilt only when `loadMore` changes — a page landed (`infinite-list.ts`).
    onReach: loadMore,
    enabled: searching && results !== null && results.hasNextPage && !moreFailed,
  });
  const tailIndex = tailIndexOf(rowCount);

  /** Opening a result writes the query into the recents (Explore.md:23). */
  const onOpen = useCallback(() => remember(asked), [remember, asked]);

  const answered = results !== null && results.query === asked;
  const shownRows = results !== null && !(slow && pending);
  const unscopedLine = results !== null && unscopedComments(results.query, results.filter.kinds);
  const nothing =
    results !== null && results.hits.length === 0 && !failed && answered && !pending && !unscopedLine;

  const band = (
    <CograBand
      node={node("band")}
      onChats={
        guest ? () => setJoinPrompt(true) : phase === "signedIn" ? () => router.push("/chats?from=explore") : undefined
      }
      // A guest's band stands bare: no bell (Explore.md:35).
      bell={
        phase === "signedIn" && reader !== null
          ? { lit: bellIsLit, onOpen: () => router.push(notificationsHref("explore")) }
          : undefined
      }
    />
  );

  return (
    <main className="flex w-full flex-col">
      {/* THE BAND GIVES WAY TO THE FIELD (ExploreSearch.jsx). The field keeps one
          place in the tree in both states, so the typing that takes the screen
          never unmounts the input it is typed into. */}
      {!searching && band}
      <div className={searching ? "flex-none pt-3" : "flex-none"}>
        <SearchBar
          query={query}
          onChange={onChange}
          placeholder={EXPLORE_PLACEHOLDER}
          ariaLabel={EXPLORE_FIELD_NAME}
          node={node("searchField")}
          onClear={toRest}
          // THE ACTION KEY ONLY DISMISSES THE KEYBOARD (Explore.md:25): the field
          // lets go of focus, and the query joins the recents.
          onAction={() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            remember(asked);
          }}
        />
        {searching && (
          <div className="flex items-center justify-between gap-1 px-4 pb-2">
            <FilterTrigger
              reading={reading}
              purpose={WHAT_THE_SEARCH_SHOWS}
              expanded={sheetOpen}
              onOpen={() => {
                setStaged(filter);
                setSheetOpen(true);
              }}
              node={node("filterTrigger")}
            />
            <HelpDot ariaLabel={HOW_SEARCHING_WORKS} onOpen={() => setSearchHelp(true)} node={node("help")} />
          </div>
        )}
      </div>

      {!searching && (
        <AtRest
          guest={guest}
          recents={recents}
          onRecent={(recent) => setQuery(recent)}
        />
      )}

      {searching && (
        <section aria-label="Results" className="flex flex-col">
          {slow && pending && (
            <p role="status" aria-live="polite" data-testid="explore-loading" className="px-6 py-2 text-body-medium text-on-surface-variant">
              Loading…
            </p>
          )}
          {failed && !pending && (rowCount > 0 ? (
            <div className="flex items-center gap-3 px-6 pt-1" role="alert">
              <span className="text-body-medium text-error" data-testid="explore-refine-failed">
                {COULDNT_LOAD_MORE}
              </span>
              <Button testId="explore-retry" variant="text" size="sm" onClick={() => read(asked, filter)}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-6 pt-2">
              <TransportError testId="explore-transport-error" />
              <Button testId="explore-retry" variant="outline" size="sm" onClick={() => read(asked, filter)}>
                Retry
              </Button>
            </div>
          ))}
          {shownRows && (
            <ResultList
              items={items}
              tailIndex={tailIndex}
              tailRef={tailRef}
              onOpen={onOpen}
              onAllProfiles={() => commit({ ...filter, kinds: ["profiles"] })}
            />
          )}
          {shownRows && unscopedLine && (
            <div className="px-6 py-2">
              <EmptyState testId="explore-empty" node={node("empty")} title={FOUND_THROUGH_PEOPLE_AND_TAGS} />
            </div>
          )}
          {shownRows && nothing && (
            <div className="px-6 py-2">
              <EmptyState testId="explore-empty" node={node("empty")} title={NOTHING_CARRIES_THAT_NAME} />
            </div>
          )}
          {moreFailed && (
            <div className="flex items-center gap-3 px-6 pt-3" role="alert">
              <span className="text-body-medium text-error" data-testid="explore-more-failed">
                {COULDNT_LOAD_MORE}
              </span>
              <Button testId="explore-more-retry" variant="text" size="sm" onClick={() => void loadMore()}>
                Retry
              </Button>
            </div>
          )}
          {loadingMore && (
            <p role="status" aria-live="polite" className="px-6 py-3 text-body-medium text-on-surface-variant">
              Loading…
            </p>
          )}
        </section>
      )}

      {/* THE APPLY IS SAID ONCE (FeedFilter.jsx; WCAG 4.1.3): Done leaves the
          trigger's new name in a polite region mounted from the start. */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="explore-filter-status">
        {announcement}
      </p>

      <FilterSheet
        open={sheetOpen}
        staged={staged}
        guest={guest}
        defaultFilter={defaultFilter}
        onStage={setStaged}
        onHelp={() => setFilterHelp(true)}
        onDone={() => {
          setSheetOpen(false);
          if (!sameSearchFilter(staged, filter)) commit(staged);
          setAnnouncement(triggerName(searchFilterSummary(staged, defaultFilter), WHAT_THE_SEARCH_SHOWS));
        }}
        onClose={() => setSheetOpen(false)}
      />
      <HelpDialog open={searchHelp} onClose={() => setSearchHelp(false)} topic={HELP_TOPICS.searching} testId="explore-help-dialog" />
      <HelpDialog
        open={filterHelp}
        onClose={() => setFilterHelp(false)}
        topic={HELP_TOPICS.theSearchFilter}
        testId="explore-filter-help-dialog"
      />
      <JoinPrompt open={joinPrompt} onClose={() => setJoinPrompt(false)} />
    </main>
  );
}

/** Explore at rest (Explore.md:3): the Sky's card, the door into Your topics, then Recent. */
function AtRest({
  guest,
  recents,
  onRecent,
}: {
  guest: boolean;
  recents: readonly string[];
  onRecent: (query: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="pb-2">
        {/* THE HERO ANNOUNCES; IT IS NOT A DOOR (Explore.md:5): it opens nothing. */}
        <Card node={node("skyCard")}>
          <div className="-mx-4 -mt-4" {...testAttributes(node("skyCard.field"))}>
            <SkyField />
          </div>
          <h2 className="m-0 text-title-medium" {...testAttributes(node("skyCard.title"))}>
            {SKY_TITLE}
          </h2>
          <p className="m-0 text-body-medium text-on-surface-variant" {...testAttributes(node("skyCard.description"))}>
            {SKY_DESCRIPTION}
          </p>
        </Card>
      </div>
      {/* NO DOOR FOR A GUEST (Explore.md:37): no guest can hold a topic. */}
      {!guest && (
        <div className="px-6 pb-2">
          {/* TODO(SS-4): the held-topics read (lane b-t) gives the second line
              its count and the door its YourTopics destination; until it lands
              the door stands without either. */}
          <ContentRow
            variant="door"
            title="Your topics"
            disc={{ kind: "letter", letter: "#" }}
            node={node("topics")}
            testId="explore-topics"
          />
        </div>
      )}
      {recents.length > 0 && (
        <>
          <SectionLabel node={node("recentLabel")}>Recent</SectionLabel>
          {recents.map((recent) => {
            const row: DataNode = { path: `${NODE}.recent`, key: recentNodeKey(recent) };
            return (
              <button
                key={recent}
                type="button"
                onClick={() => onRecent(recent)}
                {...testAttributes(row)}
                className="cg-state cg-focus flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-6 text-left font-sans text-on-surface"
              >
                <span aria-hidden="true" className="inline-flex text-on-surface-variant" {...testAttributes(part(row, "glyph"))}>
                  <Icon name="search" size={18} />
                </span>
                <span className="text-body-medium" {...testAttributes(part(row, "query"))}>
                  {recent}
                </span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}

/**
 * The Sky, teased (`_shared.jsx` `SkyField`): token colours only — `outline`
 * far, `primaryContainer` near, `primary` the most-weighted point.
 */
function SkyField({ height = 180 }: { height?: number }) {
  const y = (fraction: number) => height * fraction;
  return (
    <svg viewBox={`0 0 358 ${height}`} width="100%" height={height} aria-hidden="true" preserveAspectRatio="xMidYMid slice" className="block">
      <line x1="40" y1={y(0.55)} x2="140" y2={y(0.3)} stroke="var(--border-hairline)" strokeWidth="1" />
      <line x1="140" y1={y(0.3)} x2="230" y2={y(0.62)} stroke="var(--border-hairline)" strokeWidth="1" />
      <line x1="230" y1={y(0.62)} x2="318" y2={y(0.38)} stroke="var(--border-hairline)" strokeWidth="1" />
      <line x1="140" y1={y(0.3)} x2="196" y2={y(0.14)} stroke="var(--border-hairline)" strokeWidth="1" />
      <circle cx="40" cy={y(0.55)} r="7" fill="var(--primary-container)" />
      <circle cx="140" cy={y(0.3)} r="12" fill="var(--primary)" />
      <circle cx="196" cy={y(0.14)} r="4" fill="var(--outline)" />
      <circle cx="230" cy={y(0.62)} r="9" fill="var(--primary-container)" />
      <circle cx="318" cy={y(0.38)} r="6" fill="var(--primary-container)" />
      <circle cx="286" cy={y(0.78)} r="3" fill="var(--outline)" />
      <circle cx="90" cy={y(0.82)} r="4" fill="var(--outline)" />
    </svg>
  );
}

function ResultList({
  items,
  tailIndex,
  tailRef,
  onOpen,
  onAllProfiles,
}: {
  items: readonly ResultItem[];
  tailIndex: number;
  tailRef: (element: Element | null) => void;
  onOpen: () => void;
  onAllProfiles: () => void;
}) {
  return (
    <div className="flex flex-col" data-testid="explore-results">
      {items.map((item) => {
        switch (item.type) {
          case "profilesLabel":
            return (
              <SectionLabel key="profilesLabel" node={node("profilesLabel")}>
                {PROFILES_LABEL}
              </SectionLabel>
            );
          case "profilesDoor":
            return (
              <div key="profilesDoor" className="flex px-2 pb-2">
                <Button testId="explore-profiles-door" node={node("profilesDoor")} variant="text" size="sm" onClick={onAllProfiles}>
                  {SEE_ALL_PROFILES}
                </Button>
              </div>
            );
          case "seam":
            return <Seam key={`seam-${item.section}`} section={item.section} />;
          case "row": {
            const row: DataNode = { path: `${NODE}.result`, key: String(item.position) };
            return (
              <div key={`${item.kind}-${item.id}`} ref={item.position - 1 === tailIndex ? tailRef : undefined}>
                <ReferenceRow
                  kind={item.kind}
                  name={item.name}
                  sub={item.sub}
                  src={item.src}
                  rank={item.rank}
                  value={item.value}
                  href={item.href}
                  onOpen={onOpen}
                  node={row}
                />
              </div>
            );
          }
        }
      })}
    </div>
  );
}

/**
 * The seam (`_shared.jsx` `Seam`): where a section's ranked head ends and its
 * newest tail begins, a hairline either side of its quiet words. Each section
 * stands its own (api-spec "Order"), so a seam is keyed by its section.
 */
function Seam({ section }: { section: string }) {
  const seam: DataNode = { path: `${NODE}.seam`, key: section };
  return (
    <div className="flex items-center gap-3 px-6 py-2" {...testAttributes(seam)}>
      <span className="h-px flex-1 bg-outline-variant" />
      <span className="flex-none text-label-small text-on-surface-variant" {...testAttributes(part(seam, "label"))}>
        {BEYOND_YOUR_REACH}
      </span>
      <span className="h-px flex-1 bg-outline-variant" />
    </div>
  );
}

/**
 * THE SEARCH FILTER SHEET (ExploreFilter.md; ExploreFilter.jsx). It STAGES:
 * a chip, an order or the seen toggle changes only the staged copy and nothing
 * behind the sheet moves (:25-29); Reset stages the default and asks nothing
 * (:31); Done closes and re-queries once (:33); the scrim, a swipe down, Back
 * and Escape drop what is staged (:35-37).
 */
function FilterSheet({
  open,
  staged,
  guest,
  defaultFilter,
  onStage,
  onHelp,
  onDone,
  onClose,
}: {
  open: boolean;
  staged: SearchFilterValue;
  guest: boolean;
  defaultFilter: SearchFilterValue;
  onStage: (next: SearchFilterValue) => void;
  onHelp: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const sheet = node("filterSheet");
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={WHAT_THE_SEARCH_SHOWS}
      node={sheet}
      testId="explore-filter-sheet"
      rows
      foot={<FilterFoot node={part(sheet, "foot")} onReset={() => onStage(defaultFilter)} onDone={onDone} />}
    >
      {/* THE "?" RIDES THE SHEET'S CORNER, not the title's line (ExploreFilter.jsx:
          absolute at `--space-1` / `--space-2`): the dialog is the positioned
          box it measures from, so the title keeps its own height. */}
      <div className="absolute top-1 right-2">
        <HelpDot ariaLabel={HOW_THE_FILTER_WORKS} onOpen={onHelp} node={part(sheet, "help")} />
      </div>
      <FilterSection label="Kinds" hint={KINDS_HINT} node={part(sheet, "kinds")}>
        {SEARCH_KINDS.map((kind) => (
          <Chip
            key={kind.value}
            testId={`${NODE}.filterSheet.kinds.${kind.value}Chip`}
            selected={staged.kinds.includes(kind.value)}
            onClick={() => onStage({ ...staged, kinds: toggleKind(staged.kinds, kind.value as FeedKindValue) })}
          >
            {kind.label}
          </Chip>
        ))}
      </FilterSection>
      {/* A GUEST HAS NO VIEWPOINT TO RANK FROM AND NO SEEN-LIST (ExploreSearch.md:65;
          ExploreFilter.md:41): their search reads newest, so no order stands to pick. */}
      {!guest && (
        <OrderSection
          options={SEARCH_ORDERS}
          order={staged.order}
          onOrder={(order) => onStage({ ...staged, order })}
          seen={staged.seen}
          onSeen={(seen) => onStage({ ...staged, seen })}
          node={part(sheet, "order")}
        />
      )}
    </BottomSheet>
  );
}
