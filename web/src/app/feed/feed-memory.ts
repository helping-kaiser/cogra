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
// It is module scope on purpose. A reload starts the feed over, which is what
// a reload should do; a navigation inside the app finds the pages and the
// offset exactly as they were left, and a five-page read comes back five pages
// deep.

import type { PostView } from "@/lib/api/content-api";
import type { ScrollPlace } from "@/lib/ui/scroll-pin";

export type FeedMemory = {
  posts: readonly PostView[];
  endCursor: string | null;
  hasNextPage: boolean;
  /** The reader's place, kept current while they scroll. */
  place: ScrollPlace;
};

const TOP: ScrollPlace = { offset: 0, anchorId: null, anchorTop: 0 };

let memory: FeedMemory | null = null;

/** What the feed left behind, or null on the first arrival of this load. */
export function recallFeed(): FeedMemory | null {
  return memory;
}

/** Keep the pages. Called whenever a fetch changes what is on screen. */
export function rememberFeed(pages: Omit<FeedMemory, "place">): void {
  memory = { ...pages, place: memory?.place ?? TOP };
}

/** Keep the place. Called as the reader scrolls, so it costs no render. */
export function rememberFeedPlace(place: ScrollPlace): void {
  if (memory !== null) memory.place = place;
}

/** Drop it — for a test, and for a deliberate re-read of the feed. */
export function forgetFeed(): void {
  memory = null;
}
