// The bar's Feed slot, tapped while the feed's root is already showing — the
// re-tap rungs of the feed's ladder (Feed.md:81-91): the bar lives in the shell
// and the list in the feed, so the tap travels between them as an event, the
// same way a sheet's Done does (`feed-done.ts`).
//
// What the feed does with it is its own: back to the top, animated, when the
// root is scrolled (FeedScrolled.md:13); a refresh with its own indicator when
// it already stands at the top (Feed.md:87).

type Listener = () => void;

const listeners = new Set<Listener>();

/** Listens for the re-tap; answers the unsubscribe. */
export function onFeedReselect(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The bar's Feed slot was tapped over the feed's own root. */
export function announceFeedReselect(): void {
  for (const listener of [...listeners]) listener();
}
