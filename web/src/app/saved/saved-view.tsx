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
// SEARCH ON TOP: the one search rule, over the saved set (`saved-search.ts`).
// A search that finds nothing is SavedNone; a reader who has kept nothing
// meets SavedEmpty, which draws no field.
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
import { searchableOf } from "@/lib/saved/saved-node";
import { matches, parseQuery } from "@/lib/saved/saved-search";
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

/** Where a card's doors say the reader came from: `Back to Saved`. */
const FROM = "saved";

type Entry = SavedEntry & { readonly id: string };

function entriesOf(items: readonly SavedEntry[]): Entry[] {
  return items.map((entry) => ({ ...entry, id: entry.node.id }));
}

export function SavedScreen() {
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
  const [query, setQuery] = useState("");
  // The feed's own two hosted sheets: a post card's menu, and the thread its
  // comment count raises — over this page, as over the feed.
  const [menuPost, setMenuPost] = useState<PostView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsPost, setCommentsPost] = useState<PostView | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liveComments, setLiveComments] = useState<{ id: string; total: number } | null>(null);
  // Which read is live: a pull fires a new one, and the old one resolving
  // afterwards must not overwrite it.
  const request = useRef(0);

  // A SEARCH READS THE WHOLE SAVED SET: the contract pages the list and takes
  // no query, so a standing query walks the rest of it in, page by page —
  // started by the query itself, and again by a fresh read while one stands.
  const queryRef = useRef(query);
  const walking = useRef(false);
  const readRest = useCallback(
    async (from: string | null, more: boolean) => {
      if (walking.current || !more || from === null) return;
      walking.current = true;
      setLoadingMore(true);
      setMoreFailed(false);
      let cursor: string | null = from;
      let next: boolean = more;
      while (next && cursor !== null) {
        const after: string = cursor;
        const outcome = await guard.run(() => fetchSavedPage(client, after));
        if (outcome.kind !== "success") {
          // THE CARDS ON SCREEN STAY, and the fault ends the list (Saved.md).
          setMoreFailed(true);
          break;
        }
        setEntries((current) => appendDeduped(current, entriesOf(outcome.value.items)));
        cursor = outcome.value.endCursor;
        next = outcome.value.hasNextPage;
        setEndCursor(cursor);
        setHasNextPage(next);
      }
      setLoadingMore(false);
      walking.current = false;
    },
    [client, guard],
  );

  const read = useCallback(() => {
    const asked = (request.current += 1);
    void (async () => {
      const outcome = await guard.run(() => fetchSavedPage(client, null));
      if (asked !== request.current) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        setFailed(true);
        return;
      }
      // A FRESH LOAD: the cards' lines go (RowSigning.md:17), and the overlay
      // steps aside for what the read now says.
      writes.settle();
      setFailed(false);
      setMoreFailed(false);
      setEntries(entriesOf(outcome.value.items));
      setEndCursor(outcome.value.endCursor);
      setHasNextPage(outcome.value.hasNextPage);
      if (parseQuery(queryRef.current).kind !== "blank") {
        void readRest(outcome.value.endCursor, outcome.value.hasNextPage);
      }
    })();
  }, [client, guard, writes, readRest]);

  useEffect(() => {
    read();
    return () => {
      request.current += 1;
    };
  }, [read]);

  // Saved pull-down on (Saved.md): the platform's own refresh, through the
  // same read the first arrival takes.
  const onPull = useCallback(() => {
    setLoading(true);
    read();
  }, [read]);
  usePullToRefresh({ host, onPull });

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage || endCursor === null) return;
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await guard.run(() => fetchSavedPage(client, endCursor));
    setLoadingMore(false);
    if (outcome.kind !== "success") {
      // THE CARDS ON SCREEN STAY, and the fault ends the list (Saved.md).
      setMoreFailed(true);
      return;
    }
    setEntries((current) => appendDeduped(current, entriesOf(outcome.value.items)));
    setEndCursor(outcome.value.endCursor);
    setHasNextPage(outcome.value.hasNextPage);
  }, [client, guard, loadingMore, hasNextPage, endCursor]);

  const parsed = parseQuery(query);
  const searching = parsed.kind !== "blank";
  const onQuery = (next: string) => {
    queryRef.current = next;
    setQuery(next);
    if (parseQuery(next).kind !== "blank") void readRest(endCursor, hasNextPage);
  };

  // What the reader still keeps, plus a card whose Undo did not go through,
  // which stays carrying its line.
  const kept = entries.filter(
    (entry) =>
      writes.kept(entry.id, entry.bookmarkedAt) !== null || writes.failure(entry.id)?.kind === "restore",
  );
  const shown = kept.filter((entry) => {
    const searchable = searchableOf(entry.node);
    return searchable !== null && matches(searchable, parsed);
  });

  const tailRef = useApproachingTail({
    root: host,
    onReach: () => void loadMore(),
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

  const nothingKept = !loading && !failed && kept.length === 0 && !hasNextPage;
  // SAVEDEMPTY draws no field: it arrives with the first thing saved. A query
  // still standing keeps it, so `Show everything` is the way back.
  const empty = nothingKept && !searching;
  const none = !loading && !failed && searching && shown.length === 0 && !hasNextPage && !loadingMore;
  const fielded = !empty && (kept.length > 0 || searching);

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
            onChange={onQuery}
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
              read();
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
            onClick={() => onQuery("")}
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
            onClick={() => void (searching ? readRest(endCursor, hasNextPage) : loadMore())}
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
