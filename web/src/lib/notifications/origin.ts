// WHICH ROOT THE BELL WAS TAPPED ON (Notifications.md:27, :47, :49). The list's
// back arrow names that root and returns to it, and its bar keeps that root's
// slot lit. The bell's tap writes it into the list's URL (`?from=`); a page
// opened from a row and come back from returns to `/notifications` alone, so
// the root is also kept here, in module scope, for the length of the page load.

import { bellRootOf, type BellRoot } from "./row-content";

let remembered: BellRoot = "feed";

/** The list's href from `root`, remembering it for the way back. */
export function notificationsHref(root: BellRoot): string {
  remembered = root;
  return `/notifications?from=${root}`;
}

/** The root the list was opened from: the URL's when it names one, else the remembered one. */
export function notificationsOrigin(from: string | null): BellRoot {
  if (from !== null) remembered = bellRootOf(from);
  return remembered;
}

/** Test seam. */
export function resetNotificationsOrigin(): void {
  remembered = "feed";
}
