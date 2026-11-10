// THE ORIGIN-NAMING TABLE (design/readme.md "Back labels"): a destination
// reached from a list names that list on its back arrow and returns to it —
// `Back to Saved` from a Saved row, `Back to Notifications` from a
// notification — and the feed otherwise. One table, so the post and the
// profile cannot name the same origin two ways.

import { streamClipOf, streamHref, streamViaOf } from "@/lib/reel/stream-origin";
import { opinionsHref, parseOpinionsOrigin } from "@/lib/profile/opinions-route";
import { FROM_YOUR_TOPICS, YOUR_TOPICS_HREF } from "@/lib/topics/your-topics";

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
  // Explore and the Wallet tab as roots (ChatsComingSoon.md:15, the band's
  // chats; the tag page's origin table, design/readme.md: `Back to Explore`).
  explore: { href: "/explore", label: "Back to Explore" },
  wallet: { href: "/wallet", label: "Back to Wallet" },
  // Explore mid-query: every result opens from a standing search, and the way
  // back is to it — the query and the scroll as they were (Explore.md:19;
  // ProfileOther.md:73, PostDetail's origin-noun table).
  search: { href: "/explore", label: "Back to the search" },
  // Your topics, Explore's subpage (TagPage.md:35: `Back to Your topics` from
  // Your topics) — its rows open the topic's page.
  [FROM_YOUR_TOPICS]: { href: YOUR_TOPICS_HREF, label: "Back to Your topics" },
};

// A CHAINED ORIGIN CARRIES THE ONE ITS PAGE WAS OPENED WITH (readme §4 and
// BottomNav: "a stack is where a screen was opened FROM"): a door out of
// someone's profile, a tag's page or the stream names that page and, after a
// slash, the `from` the page itself was opened with — `u:ada/saved`,
// `tag:coast/search`, `stream:v2/saved` — so what it opens keeps lit the root
// the page's stack began in, and its way back hands the page its own origin
// again. The opinions token chains the same way (`opinions-route.ts`). A
// handle, a tag's name and a post id never hold a slash, so the first slash
// ends the head and the tail nests as deep as the reader walked.

/** `token`, carrying the origin its page was opened with, if any. */
export function chained(token: string, from: string | null | undefined): string {
  return from === null || from === undefined || from === "" ? token : `${token}/${from}`;
}

/** A chained token's head and the origin it carries, or null when `from` does not start with `prefix`. */
function unchain(from: string | null | undefined, prefix: string): { head: string; from: string | null } | null {
  if (typeof from !== "string" || !from.startsWith(prefix)) return null;
  const rest = from.slice(prefix.length);
  const at = rest.indexOf("/");
  const head = at < 0 ? rest : rest.slice(0, at);
  if (head === "") return null;
  const tail = at < 0 ? "" : rest.slice(at + 1);
  return { head, from: tail === "" ? null : tail };
}

/** Someone else's profile as an origin: `from=u:<handle>`. */
export const PERSON_ORIGIN = "u:";

/** The `from` a surface opened from someone's profile carries, chaining the profile's own. */
export function personOrigin(handle: string, from: string | null = null): string {
  return chained(`${PERSON_ORIGIN}${handle}`, from);
}

/** The profile a `from` names, with the origin it was opened with; null where it names none. */
export function parsePersonOrigin(from: string | null | undefined): { handle: string; from: string | null } | null {
  const found = unchain(from, PERSON_ORIGIN);
  return found === null ? null : { handle: found.head, from: found.from };
}

/** A tag's page as an origin: `from=tag:<name>`. */
export const TAG_ORIGIN = "tag:";

/** The `from` a door out of a tag's page carries, chaining the page's own. */
export function tagOrigin(name: string, from: string | null = null): string {
  return chained(`${TAG_ORIGIN}${name}`, from);
}

/** The tag a `from` names, with the origin its page was opened with; null where it names none. */
export function parseTagOrigin(from: string | null | undefined): { name: string; from: string | null } | null {
  const found = unchain(from, TAG_ORIGIN);
  return found === null ? null : { name: found.head, from: found.from };
}

/** A tag's page, opened with `from` so its own arrow names where it came from. */
export function tagPageHref(name: string, from: string | null = null): string {
  const path = `/topics/${encodeURIComponent(name)}`;
  return from === null || from === "" ? path : `${path}?from=${encodeURIComponent(from)}`;
}

/** Someone's profile, opened with `from`. */
export function personHref(handle: string, from: string | null = null): string {
  const path = `/u/${encodeURIComponent(handle)}`;
  return from === null || from === "" ? path : `${path}?from=${encodeURIComponent(from)}`;
}

/**
 * A post's own detail as the score's origin: `post:<id>`, then `:<via>` — the
 * detail's own `from` (`trace-session.ts`, `originParam`).
 */
export function parsePostOrigin(from: string | null | undefined): { postId: string; via: string | null } | null {
  if (typeof from !== "string" || !from.startsWith("post:")) return null;
  const [postId, ...via] = from.slice("post:".length).split(":");
  return { postId: postId ?? "", via: via.length > 0 ? via.join(":") : null };
}

/**
 * The origin a chained `from` carries — the one its page was opened with,
 * null where it carries none — or undefined where `from` is no chained token.
 * The shell's lit root walks it (`detailRoot`).
 */
export function carriedOrigin(from: string | null | undefined): string | null | undefined {
  const person = parsePersonOrigin(from);
  if (person !== null) return person.from;
  const tag = parseTagOrigin(from);
  if (tag !== null) return tag.from;
  const post = parsePostOrigin(from);
  if (post !== null) return post.via;
  if (streamClipOf(from) !== null) return streamViaOf(from);
  return undefined;
}

const FEED: BackTarget = { href: "/feed", label: "Back to feed" };

/** Where the back arrow goes and what it reads, by the `from` the page was opened with. */
export function backFor(from: string | null | undefined): BackTarget {
  if (from === null || from === undefined) return FEED;
  // A row on a profile's opinions page reads `Back to the opinions`
  // (ProfileStances.md:41; copy-voice, the list named by what it holds) and
  // returns to the page on the tab it was left on, opened with the origin it
  // was opened with (`opinions-route.ts`, the chain).
  const opinions = parseOpinionsOrigin(from);
  if (opinions !== null) {
    return {
      href: opinionsHref(opinions.handle, opinions.direction, opinions.from),
      label: "Back to the opinions",
    };
  }
  // Someone else's profile reads `Back to the profile` (ProfileOther.md:63;
  // ChatsComingSoon.md:17, a profile's Message), and returns to it opened
  // with the origin it was opened with.
  const person = parsePersonOrigin(from);
  if (person !== null) return { href: personHref(person.handle, person.from), label: "Back to the profile" };
  // A tag's page reads `Back to #<thattag>` (readme §13, the post detail's and
  // the profile's origin-noun tables; ProfileOther.md:73), and returns to the
  // page opened with the origin it was opened with.
  const tag = parseTagOrigin(from);
  if (tag !== null) return { href: tagPageHref(tag.name, tag.from), label: `Back to #${tag.name}` };
  // The stream reads `Back to the stream` and returns into it at the clip the
  // reader left (copy-voice.md:721-722; PostDetailVideo.md:33).
  const clip = streamClipOf(from);
  if (clip !== null) return { href: streamHref(clip), label: "Back to the stream" };
  return ORIGINS[from] ?? FEED;
}
