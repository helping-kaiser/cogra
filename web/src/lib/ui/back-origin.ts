// THE ORIGIN-NAMING TABLE (design/readme.md "Back labels"): a destination
// reached from a list names that list on its back arrow and returns to it —
// `Back to Saved` from a Saved row, `Back to Notifications` from a
// notification — and the feed otherwise. One table, so the post and the
// profile cannot name the same origin two ways.

export type BackTarget = { readonly href: string; readonly label: string };

const ORIGINS: Record<string, BackTarget> = {
  saved: { href: "/saved", label: "Back to Saved" },
  notifications: { href: "/notifications", label: "Back to Notifications" },
};

const FEED: BackTarget = { href: "/feed", label: "Back to feed" };

/** Where the back arrow goes and what it reads, by the `from` the page was opened with. */
export function backFor(from: string | null | undefined): BackTarget {
  return (from !== null && from !== undefined && ORIGINS[from]) || FEED;
}
