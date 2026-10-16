"use client";

// SAVED — everything the reader kept, as a feed (Saved.md, SavedUndo.md,
// SavedEmpty.md, SavedNone.md; design/designs/canonical/screens/Saved.jsx,
// round 12). Reached from the reader's own profile's ⋮.
//
// ONE MIXED LIST, EACH THING AS ITS KIND'S OWN FEED CARD: a post as the
// feed's `PostCard`, a comment as the `CommentFeedCard`, a person as the
// `ProfileFeedCard` — unchanged and fully live, so the opinion, the kind's own
// act and the share answer here exactly as on the feed. No card anatomy is
// this page's own: no age of the save, no kind label, no heading, no saved
// mark and no unsave control of Saved's own (the quiet-card law).
//
// NEWEST FIRST, BY WHEN THE READER SAVED EACH THING — never by when it was
// written or seen, and never by score.
//
// THE UNSAVE IS THE CARD'S OWN SAVE. Every card's ⋮ leads with `Save` /
// `Unsave`, and here every card is kept, so the row reads `Unsave`: the sheet
// closes, the card leaves, the cards behind it move up, and `Removed from
// Saved.` with `Undo` answers on this page's snackbar.
//
// THE LIST IS THE LAST READ WITH THE READER'S OWN ACTS LAID OVER IT
// (`SavedWrites`). That one rule carries the rest: Undo puts the card back in
// its place (the loaded page still holds it); an unsave made inside a page
// opened from here is gone on return, with no snackbar; a failed unsave brings
// the card back carrying `That didn't go through.` with Retry; a failed Undo's
// card stays on screen carrying that line.
//
// SEARCH ON TOP: the one search law, over the saved set, RUN ON THE SERVER
// (`User.bookmarks(query:)`; api-spec.md "Search", **Saved**). The matcher has
// to see the whole saved set, so a match is found wherever it stands, never
// only within the pages this browser has loaded. The field narrows once typing
// settles; the list on screen stands until the narrowed one arrives, and the
// list is drawn in the order served — people, then content, newest save first
// inside each. A search that finds nothing is SavedNone; a reader who has kept
// nothing meets SavedEmpty, which draws no field.
//
// A HIDDEN ACCOUNT'S THINGS STAY: the hidden list is the feed's, not this
// one's (ruling 49d), so nothing here reads the hidden set.

import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { CommentsSheet } from "@/app/comments/comments-sheet";
import type { PostView } from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import { fetchSavedPage, type SavedEntry, type SavedPost } from "@/lib/api/saved-api";
import { useSavedWrites } from "@/lib/saved/provider";
import { useHostSnack } from "@/lib/saved/save-row";
import { useAuthGuard } from "@/lib/session/runtime";
import { Button } from "@/lib/ui/button";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { CommentFeedCard } from "@/lib/ui/comment-feed-card";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { PageHeader } from "@/lib/ui/page-header";
import { PostCard } from "@/lib/ui/post-card";
import { ProfileFeedCard } from "@/lib/ui/profile-feed-card";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { scrollHostToTopAnimated, useScrollHost } from "@/lib/ui/scroll-host";
import { LINK_COPIED } from "@/lib/ui/share";
import { Snackbar } from "@/lib/ui/snackbar";
import { TransportError } from "@/lib/ui/transport-error";
import { StageHost } from "@/lib/ui2/media/stage-host";
import { PostMenuHost } from "@/lib/ui2/post-menu-host";
import { SearchBar } from "@/lib/ui2/search-bar";

/** SavedEmpty.md:3, verbatim. */
export const SAVED_EMPTY =
  "Nothing saved yet. A post, a comment or a person can be saved from its own menu, and it waits here.";

/** SavedNone.md:3, verbatim. */
export const SAVED_NONE =
  "Nothing you've saved carries that name. Search reads names and titles, never bodies — fewer words reach further.";

/** SavedNone.md:7 — the empty state's one action. */
export const SHOW_EVERYTHING = "Show everything";

/** Saved.jsx: the field's placeholder, naming the list it searches. */
export const SEARCH_WHAT_YOU_SAVED = "Search what you saved";

/** The chronicle's load-more fault (design digest item 57; Saved.md). */
export const COULDNT_LOAD_MORE = "Couldn't load more";

/** How long the field waits for typing to settle before Saved narrows. */
export const SAVED_SEARCH_DEBOUNCE_MS = 250;

/** Where a card's doors say the reader came from: `Back to Saved`. */
const FROM = "saved";

type Entry = SavedEntry & { readonly id: string };

/** The kinds Saved stands as cards; a kind a later slice adds waits for its card. */
function isCardKind(entry: SavedEntry): boolean {
  const kind = entry.node.__typename;
  return kind === "Post" || kind === "Comment" || kind === "User";
}

function entriesOf(items: readonly SavedEntry[]): Entry[] {
  return items.filter(isCardKind).map((entry) => ({ ...entry, id: entry.node.id }));
}

export function SavedScreen({
  searchDebounceMs = SAVED_SEARCH_DEBOUNCE_MS,
}: {
  /** Test injection — how long the field waits for typing to settle. */
  searchDebounceMs?: number;
} = {}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const host = useScrollHost();
  const writes = useSavedWrites();
  const { snack, notify, dismiss } = useHostSnack();

  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  // What the reader typed, and the query the list on screen answers — null
  // until the first read lands. They differ while typing settles and while
  // the narrowed read is on its way.
  const [query, setQuery] = useState("");
  const [listQuery, setListQuery] = useState<string | null>(null);
  // The feed's own two hosted sheets: a post card's menu, and the thread its
  // comment count raises — over this page, as over the feed.
  const [menuPost, setMenuPost] = useState<PostView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsPost, setCommentsPost] = useState<PostView | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liveComments, setLiveComments] = useState<{ id: string; total: number } | null>(null);
  // Which read is live: a pull or a new query fires a new one, and an older
  // one — a first page or a next page — resolving afterwards must not
  // overwrite it.
  const request = useRef(0);
  // The query the list on screen answers, for the reads that continue it.
  const listQueryRef = useRef<string | null>(null);

  /** The first page of Saved narrowed by `asked` (blank: the whole list). */
  const read = useCallback(
    (asked: string) => {
      const mine = (request.current += 1);
      void (async () => {
        const outcome = await guard.run(() => fetchSavedPage(client, null, asked));
        if (mine !== request.current) return;
        setLoading(false);
        if (outcome.kind !== "success") {
          setFailed(true);
          // A FAILED REFRESH keeps the cards on screen; a failed NEW QUERY
          // must not leave another query's cards standing as its answer.
          if (asked !== listQueryRef.current) {
            listQueryRef.current = asked;
            setListQuery(asked);
            setEntries([]);
            setEndCursor(null);
            setHasNextPage(false);
          }
          return;
        }
        // A FRESH LOAD: the cards' lines go (RowSigning.md:17), and the overlay
        // steps aside for what the read now says.
        writes.settle();
        listQueryRef.current = asked;
        setListQuery(asked);
        setFailed(false);
        setMoreFailed(false);
        setEntries(entriesOf(outcome.value.items));
        setEndCursor(outcome.value.endCursor);
        setHasNextPage(outcome.value.hasNextPage);
      })();
    },
    [client, guard, writes],
  );

  // THE FIELD NARROWS ONCE TYPING SETTLES — the finder's debounce shape
  // (`reference-finder.tsx`): every keystroke would otherwise be a read, and
  // only the last one's answer could ever stand. Clearing the field asks for
  // the whole list at once. The first arrival is this same read, blank.
  const asked = query.trim();
  const arrived = useRef(false);
  useEffect(() => {
    const wait = !arrived.current || asked === "" ? 0 : searchDebounceMs;
    arrived.current = true;
    const timer = setTimeout(() => read(asked), wait);
    return () => {
      clearTimeout(timer);
      request.current += 1;
    };
  }, [asked, read, searchDebounceMs]);

  // Saved pull-down on (Saved.md): the platform's own refresh, through the
  // same read the first arrival takes, of the list the field asks for.
  const onPull = useCallback(() => {
    setLoading(true);
    read(asked);
  }, [read, asked]);
  usePullToRefresh({ host, onPull });

  // THE NEXT PAGE OF THE SAME LIST: a narrowed list pages on cursors of its
  // own, so the next page carries the query its first page answered.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage || endCursor === null) return;
    const mine = request.current;
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await guard.run(() => fetchSavedPage(client, endCursor, listQueryRef.current ?? ""));
    setLoadingMore(false);
    // A new read replaced the list this page continued.
    if (mine !== request.current) return;
    if (outcome.kind !== "success") {
      // THE CARDS ON SCREEN STAY, and the fault ends the list (Saved.md).
      setMoreFailed(true);
      return;
    }
    setEntries((current) => appendDeduped(current, entriesOf(outcome.value.items)));
    setEndCursor(outcome.value.endCursor);
    setHasNextPage(outcome.value.hasNextPage);
  }, [client, guard, loadingMore, hasNextPage, endCursor]);

  const searching = asked !== "";
  const narrowed = listQuery !== null && listQuery !== "";

  // What the reader still keeps, plus a card whose Undo did not go through,
  // which stays carrying its line — in the order the server served them.
  const shown = entries.filter(
    (entry) =>
      writes.kept(entry.id, entry.bookmarkedAt) !== null || writes.failure(entry.id)?.kind === "restore",
  );

  // The watch is rebuilt only when `loadMore` changes — a page landed, a fresh
  // cursor — never on a render that changed nothing (`infinite-list.ts`).
  const tailRef = useApproachingTail({
    root: host,
    onReach: loadMore,
    enabled: hasNextPage && !moreFailed,
  });
  const tailIndex = tailIndexOf(shown.length);

  // FOCUS AFTER A CARD'S UNSAVE LANDS (Saved.md; the K13 focus law): the next
  // card, else the previous, else the empty state.
  const cards = useRef(new Map<string, HTMLDivElement>());
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const before = useRef<readonly string[]>([]);
  const shownIds = shown.map((entry) => entry.id).join(" ");
  useEffect(() => {
    const now = shownIds === "" ? [] : shownIds.split(" ");
    const previous = before.current;
    before.current = now;
    const gone = previous.filter((id) => !now.includes(id) && writes.touched(id));
    if (gone.length !== 1) return;
    const at = previous.indexOf(gone[0]!);
    const next = previous.slice(at + 1).find((id) => now.includes(id));
    const prior = [...previous.slice(0, at)].reverse().find((id) => now.includes(id));
    const card = cards.current.get(next ?? prior ?? "");
    const target = card?.querySelector<HTMLElement>("a[href], button") ?? emptyRef.current;
    target?.focus();
  }, [shownIds, writes]);

  const nothingShown = !loading && !failed && shown.length === 0 && !hasNextPage && !loadingMore;
  // SAVEDEMPTY is the whole list holding nothing, and draws no field: it
  // arrives with the first thing saved. A query still standing keeps the
  // field, so `Show everything` is the way back.
  const empty = nothingShown && !narrowed && !searching;
  // SAVEDNONE is the server's answer to a standing query holding nothing; it
  // stands while the next keystroke's answer is on its way, and goes the
  // moment the field is cleared.
  const none = nothingShown && narrowed && searching;
  const fielded = !empty && (shown.length > 0 || searching || narrowed);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col">
      {/* THE HEADER AND THE FIELD COLLAPSE ON THE WAY DOWN AND RETURN ON THE
          WAY UP, and a reader three screens down summons Back to top with
          them; its tap goes up, animated, and never re-reads. */}
      <CollapsingTop onBackToTop={() => scrollHostToTopAnimated(host)}>
        <PageHeader
          title="Saved"
          backHref="/profile"
          backLabel="Back to your profile"
          backScroll={false}
          backTestId="saved-back"
          node={{ path: "saved.header" }}
        />
        {fielded && (
          <SearchBar
            query={query}
            onChange={setQuery}
            placeholder={SEARCH_WHAT_YOU_SAVED}
            ariaLabel={SEARCH_WHAT_YOU_SAVED}
            node={{ path: "saved.searchField" }}
          />
        )}
      </CollapsingTop>
      {loading && entries.length === 0 && (
        <p role="status" aria-live="polite" data-testid="saved-loading" className="px-4 pt-2">
          Loading…
        </p>
      )}
      {failed && entries.length === 0 && !loading && (
        <div className="flex items-center gap-3 px-4 pt-2">
          <TransportError testId="saved-transport-error" />
          <Button
            testId="saved-retry"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              read(asked);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {empty && (
        // SAVEDEMPTY: words only — no action button, no error colour, and the
        // save named in words, never drawn as its glyph.
        <div className="px-6 pt-2" data-testid="saved.empty">
          <p
            ref={emptyRef}
            tabIndex={-1}
            data-testid="saved.empty.title"
            className="py-2 text-body-medium text-on-surface-variant outline-none"
          >
            {SAVED_EMPTY}
          </p>
        </div>
      )}
      {none && (
        // SAVEDNONE: the reader's own search found nothing — the field keeps
        // the query, and the one way back clears it.
        <div className="flex flex-col items-start gap-3 px-6 pt-2" data-testid="saved.empty">
          <p
            ref={emptyRef}
            tabIndex={-1}
            data-testid="saved.empty.title"
            className="py-2 text-body-medium text-on-surface-variant outline-none"
          >
            {SAVED_NONE}
          </p>
          <Button
            testId="saved-none-action"
            node={{ path: "saved.empty.action" }}
            variant="outline"
            size="sm"
            selfStart
            onClick={() => setQuery("")}
          >
            {SHOW_EVERYTHING}
          </Button>
        </div>
      )}
      {shown.length > 0 && (
        // THE FEED'S ONE STAGE (Saved.md): at most one clip plays, and the
        // stage re-elects at the list's hard top, by the feed's law.
        <StageHost>
          <ul data-testid="saved-list" className="m-0 flex list-none flex-col gap-2 p-0 pt-2">
            {shown.map((entry, index) => (
              <li key={entry.id} data-saved-id={entry.id} ref={index === tailIndex ? tailRef : undefined}>
                <div
                  ref={(element) => {
                    if (element === null) cards.current.delete(entry.id);
                    else cards.current.set(entry.id, element);
                  }}
                >
                <SavedCard
                  entry={entry}
                  notify={notify}
                  comments={(post) =>
                    liveComments?.id === post.id ? liveComments.total : post.comments.totalCount
                  }
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
                </div>
              </li>
            ))}
          </ul>
        </StageHost>
      )}
      {moreFailed && (
        <div className="flex items-center gap-3 px-4 pt-3" role="alert">
          <span className="text-body-medium text-error" data-testid="saved-more-failed">
            {COULDNT_LOAD_MORE}
          </span>
          <Button
            testId="saved-more-retry"
            variant="text"
            size="sm"
            onClick={() => void loadMore()}
          >
            Retry
          </Button>
        </div>
      )}
      {loadingMore && (
        <p role="status" aria-live="polite" data-testid="saved-loading-more" className="px-4 pt-3">
          Loading…
        </p>
      )}
      <Snackbar
        testId="saved-snackbar"
        node={{ path: "saved.snackbar" }}
        message={snack?.message ?? null}
        action={snack?.action}
        token={snack?.token}
        onDismiss={dismiss}
      />
      {/* A POST CARD'S MENU, OVER SAVED: the reader's menu every post card
          opens, its Unsave first, its aftermath on this page's snackbar. */}
      <PostMenuHost
        post={menuPost}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        testId="saved-menu"
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

/** One kept thing, as its kind's own feed card. */
function SavedCard({
  entry,
  notify,
  comments,
  onOpenComments,
  onOpenMenu,
  menuOpenFor,
}: {
  entry: Entry;
  notify: ReturnType<typeof useHostSnack>["notify"];
  comments: (post: SavedPost) => number;
  onOpenComments: (post: SavedPost) => void;
  onOpenMenu: (post: SavedPost) => void;
  menuOpenFor: string | null;
}) {
  const node = entry.node;
  const copied = () => notify(LINK_COPIED);
  switch (node.__typename) {
    case "Post":
      return (
        <PostCard
          post={node}
          // Each card keeps its kind's own name on the page (Saved.jsx),
          // keyed by the record's own identity, as the feed keys its cards.
          node={{ path: "saved.card", key: node.id }}
          href={`/posts/${node.id}?from=${FROM}`}
          shareHref={`/posts/${node.id}`}
          testId={`saved-post-${node.id}`}
          authorTestId={`saved-author-${node.id}`}
          stanceTestId={`saved-stance-${node.id}`}
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
          node={{ path: "saved.commentCard", key: node.id }}
          testId={`saved-comment-${node.id}`}
          onNotify={notify}
          onLinkCopied={copied}
        />
      );
    case "User":
      return (
        <ProfileFeedCard
          person={node}
          href={`/u/${node.handle}?from=${FROM}`}
          node={{ path: "saved.profileCard", key: node.id }}
          testId={`saved-person-${node.id}`}
          onNotify={notify}
          onLinkCopied={copied}
        />
      );
    default:
      return null;
  }
}
