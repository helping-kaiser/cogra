// THE ORIGINS' NEXT PAGES, as the stream asks for them (Reel.md:3; the reel
// packet's contract verdict: "pure client narrowing", no read of its own).
//
// Each origin keeps walking ITS OWN list past the edge the surface had
// reached, with the read that surface already uses: the feed hydrates the next
// window of the derived list it holds (`RankedFeed.window`, ≤ 20 ids a window,
// inside `feed`'s cap of 100, CD-2), History reads its next page with the
// narrowing its first page answered, and a profile's posts view reads its next
// page of the same posts read. The stream never ranks: the feed's
// windows hydrate a list whose order was fixed when it was derived, and
// `feedRanking` is never asked (BD-4: "No relay call is its own").
//
// THE CLOSURES OUTLIVE THEIR SURFACE. The surface that tapped is unmounted the
// moment the stream's route renders, so nothing here may lean on its mounted
// state — the feed's `alive` gate in particular, which refuses every read once
// the feed has left the screen.

import type { ApolloClient } from "@apollo/client";

import { fetchHistoryPage, type HistoryEntry } from "@/lib/api/history-api";
import { fetchProfilePosts } from "@/lib/api/profile-api";
import type { PostView } from "@/lib/api/content-api";
import type { FeedItemView } from "@/lib/api/feed-api";
import { success } from "@/lib/api/outcome";
import type { FeedIo, RankedFeed } from "@/lib/feed/ranked-feed";
import type { NodeKind } from "@/__generated__/graphql";
import type { AuthGuard } from "@/lib/session/guard";

import type { LoadOrigin } from "./stream-session";

/** A row the stream may narrow: a post, never another kind. */
function postsOf(items: readonly FeedItemView[]): PostView[] {
  return items.filter((item): item is PostView & FeedItemView => item.__typename === "Post");
}

/**
 * The feed it narrowed: the held derived list's windows from `from` on. The
 * reader's hidden set cuts here as it cuts the feed's drawn rows (FeedHidden.md
 * :3) — "hidden authors never enter the stream".
 */
export function feedOrigin(
  feed: RankedFeed,
  from: number,
  io: Pick<FeedIo, "hydrate" | "hides" | "current">,
): LoadOrigin {
  let next = from;
  // `window` reads nothing but these three; a ranking is never asked for.
  const reads: FeedIo = {
    resolveViewer: () => Promise.reject(new Error("the stream never ranks")),
    rank: () => Promise.reject(new Error("the stream never ranks")),
    seen: () => Promise.reject(new Error("the stream never derives")),
    ...io,
  };
  return async () => {
    const window = await feed.window(next, reads);
    if (window.kind !== "success") return window;
    next = window.value.next;
    const shown = window.value.items.filter((item) => io.hides?.(item) !== true);
    return success({ rows: postsOf(shown), hasMore: window.value.hasMore });
  };
}

/** History's rows: its next pages, narrowed as the list on screen was. */
export function historyOrigin({
  client,
  guard,
  after,
  query,
  kinds,
  admits,
}: {
  client: ApolloClient;
  /** The session's guard, as History's own reads run under it. */
  guard: AuthGuard;
  after: string | null;
  query: string;
  kinds: readonly NodeKind[] | null;
  /** History's own cut of what a page stands (`entriesOf`): the hidden set's. */
  admits: (entry: HistoryEntry) => boolean;
}): LoadOrigin {
  let cursor = after;
  return async () => {
    const page = await guard.run(() => fetchHistoryPage(client, cursor, query, kinds));
    if (page.kind !== "success") return page;
    cursor = page.value.endCursor;
    const rows = page.value.items
      .filter(admits)
      .map((entry) => entry.node)
      .filter((node): node is PostView & typeof node => node.__typename === "Post");
    return success({ rows, hasMore: page.value.hasNextPage && cursor !== null });
  };
}

/**
 * The profile's posts (Reel.md:3, "the profile's posts"): the posts view's
 * next pages from where the view had reached, in the view's own order —
 * newest first by landing, the read the view itself pages with. Every row is
 * the person's post, so nothing is cut but what the stream narrows.
 */
export function profileOrigin({
  client,
  authorId,
  after,
}: {
  client: ApolloClient;
  /** The person whose posts the view lists. */
  authorId: string;
  /** Where the view's own paging stood; the stream continues from there. */
  after: string | null;
}): LoadOrigin {
  let cursor = after;
  return async () => {
    const page = await fetchProfilePosts(client, authorId, cursor);
    if (page.kind !== "success") return page;
    cursor = page.value.endCursor;
    return success({ rows: page.value.items, hasMore: page.value.hasNextPage && cursor !== null });
  };
}
