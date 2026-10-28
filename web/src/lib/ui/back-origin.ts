// THE ORIGIN-NAMING TABLE (design/readme.md "Back labels"): a destination
// reached from a list names that list on its back arrow and returns to it —
// `Back to Saved` from a Saved row, `Back to Notifications` from a
// notification — and the feed otherwise. One table, so the post and the
// profile cannot name the same origin two ways.

export type BackTarget = { readonly href: string; readonly label: string };

const ORIGINS: Record<string, BackTarget> = {
  saved: { href: "/saved", label: "Back to Saved" },
  // The reader's seen-list (History.md:47-61: every door out of History
  // reads `Back to History`).
  history: { href: "/history", label: "Back to History" },
  notifications: { href: "/notifications", label: "Back to Notifications" },
  // The reader's own profile (Profile.md: a chronicle card's post reads
  // `Back to your profile`; ChatsComingSoon.md:15, the band's chats).
  profile: { href: "/profile", label: "Back to your profile" },
};

/** Someone else's profile as an origin: `from=u:<handle>`. */
export const PERSON_ORIGIN = "u:";

/** The `from` a surface opened from someone's profile carries. */
export function personOrigin(handle: string): string {
  return `${PERSON_ORIGIN}${handle}`;
}

const FEED: BackTarget = { href: "/feed", label: "Back to feed" };

/** Where the back arrow goes and what it reads, by the `from` the page was opened with. */
export function backFor(from: string | null | undefined): BackTarget {
  if (from === null || from === undefined) return FEED;
  // Someone else's profile reads `Back to the profile` (ProfileOther.md:63;
  // ChatsComingSoon.md:17, a profile's Message).
  if (from.startsWith(PERSON_ORIGIN) && from.length > PERSON_ORIGIN.length) {
    return {
      href: `/u/${encodeURIComponent(from.slice(PERSON_ORIGIN.length))}`,
      label: "Back to the profile",
    };
  }
  return ORIGINS[from] ?? FEED;
}
