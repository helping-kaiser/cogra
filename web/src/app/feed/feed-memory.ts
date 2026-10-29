// WHERE THE READER WAS. The feed is a client surface holding its pages and
// its place in component state, and the App Router UNMOUNTS a page on
// navigation — so opening a post and coming back re-mounted the list at page
// one and the top, however far down the reader had got.
//
// Next 16 preserves state and scroll across navigations with Cache Components,
// which hides a route behind React's `<Activity>` instead of unmounting it
// (`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`).
// That flag is a whole-app rendering migration — every route revalidated
// against instant-navigation, `use cache` or a Suspense boundary per blocking
// read (`.../migrating-to-cache-components.md`) — and it would also start
// preserving the wizards and the key ceremony, whose traps and one-shot
// dialogs are written for a fresh mount. So this takes the other mechanism the
// same guide names for a pre-Cache-Components app: "using an external store".
//
// It is module scope on purpose, and that is also the ranked feed's
// staleness law (ranked-feed packet §21 RF-G11, PR-55):
//
// - A COLD START ALWAYS RANKS AGAIN. A reload or a reopened tab is a new page
//   load, which starts with nothing remembered, so the first feed view asks
//   for a fresh ranking.
// - A RETURN FROM THE BACKGROUND NEVER DOES. A hidden tab keeps this memory
//   exactly as it was, however long it was away, and nothing listens for the
//   return: the reader comes back to the list they left. Fresh content is the
//   reader's own ask — the pull, or a Retry.
// - In between, a navigation inside the app finds the held ranking, the pages
//   and the offset exactly as they were left, and a five-page read comes back
//   five pages deep.
//
// THE MEMORY IS ONE READER'S. The held ranking is cut by its reader's seen
// record, so a different reader — a sign-in, a sign-out, an account switch —
// is a feed that has not been here yet, never someone else's list.

import type { FeedItemView } from "@/lib/api/feed-api";
import type { FeedFilterValue } from "@/lib/feed/feed-filter";
import type { RankedFeed } from "@/lib/feed/ranked-feed";
import type { ScrollPlace } from "@/lib/ui/scroll-pin";

export type FeedMemory = {
  /** The held ranking: its answer, filter, derived list and hydrated rows. */
  feed: RankedFeed;
  /** The hydrated rows on screen, of every kind the filter let in. */
  posts: readonly FeedItemView[];
  /** Where the next window starts in the derived list; null at its end. */
  endCursor: string | null;
  hasNextPage: boolean;
  /** The reader's place, kept current while they scroll. */
  place: ScrollPlace;
};

const TOP: ScrollPlace = { offset: 0, anchorId: null, anchorTop: 0 };

let memory: FeedMemory | null = null;

/** What the feed left behind for `reader`, or null on their first arrival of this load. */
export function recallFeed(reader: string | null): FeedMemory | null {
  return memory !== null && memory.feed.reader === reader ? memory : null;
}

/** Keep the pages. Called whenever a fetch changes what is on screen. */
export function rememberFeed(pages: Omit<FeedMemory, "place">): void {
  const place = memory !== null && memory.feed === pages.feed ? memory.place : TOP;
  memory = { ...pages, place };
}

/** Keep the place. Called as the reader scrolls, so it costs no render. */
export function rememberFeedPlace(place: ScrollPlace): void {
  if (memory !== null) memory.place = place;
}

/**
 * THE FILTER SHEET THAT LAUNCHED A FORWARD NAVIGATION COMES BACK (design
 * readme, *A sheet that launched a forward navigation comes back*; flows.json:
 * FeedSheet → YourTopics, "back returns the feed with this sheet up, as it was
 * left"): what it had staged and where its body stood, for the reader who left.
 */
export type FeedSheetMemory = {
  readonly reader: string | null;
  readonly staged: FeedFilterValue;
  readonly offset: number;
};

let sheet: FeedSheetMemory | null = null;

/** Keep the sheet as it was left, at the moment its door navigates away. */
export function rememberFeedSheet(left: FeedSheetMemory): void {
  sheet = left;
}

/**
 * The sheet `reader` left, or null. A READ, NOT A TAKE: a lazy state
 * initializer may run twice (React StrictMode), so the feed drops it with
 * {@link forgetFeedSheet} once the sheet is back up.
 */
export function recallFeedSheet(reader: string | null): FeedSheetMemory | null {
  return sheet !== null && sheet.reader === reader ? sheet : null;
}

/** The sheet is back up — or another reader arrived: it comes back once. */
export function forgetFeedSheet(): void {
  sheet = null;
}

/** Drop it — the page load ending (a cold start), for a test. */
export function forgetFeed(): void {
  memory = null;
  sheet = null;
}
