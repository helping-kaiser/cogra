// THE FEED SHEET'S DONE, as the feed hears it (FeedSheet.md:81; CD-1). The
// sheet stages its changes and hands the staged value over on Done; the feed
// screen — which holds the ranking — decides whether that ranks again or only
// re-derives (`RankedFeed.done`). The sheet itself is the feed/card rework's
// to build (BD-2); this is the one seam it calls, so the feed's data path is
// complete and testable without it.

import type { FeedFilterValue } from "./feed-filter";

type Listener = (staged: FeedFilterValue) => void;

const listeners = new Set<Listener>();

/** Hears every Done from now on; returns the unsubscribe. */
export function onFeedDone(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Says the sheet was closed with Done over `staged`. */
export function announceFeedDone(staged: FeedFilterValue): void {
  for (const listener of [...listeners]) listener(staged);
}
