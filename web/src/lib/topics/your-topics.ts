// Where Your topics lives and how its two doors and its rows name their way
// back (design readme, the tag pages' origin table, which Your topics' arrow
// takes; flows.json: Explore → YourTopics, FeedSheet → YourTopics). One small
// module, so the feed and Explore reach the subpage without importing it.

import type { BackTarget } from "@/lib/ui/back-origin";

/** Your topics: Explore's subpage (design readme, "a subpage off Explore"). */
export const YOUR_TOPICS_HREF = "/explore/topics";

/** The `from` the feed filter's `All your topics` carries. */
export const FROM_FEED = "feed";

/** The `from` a row's topic page carries: its arrow reads `Back to Your topics`. */
export const FROM_YOUR_TOPICS = "yourTopics";

/**
 * Where Your topics' arrow goes and what it reads: `Back to feed` from the
 * feed's sheet; Explore's door and a cold entry read `Back to Explore`, the
 * state the board draws.
 */
export function yourTopicsBack(from: string | null): BackTarget {
  return from === FROM_FEED
    ? { href: "/feed", label: "Back to feed" }
    : { href: "/explore", label: "Back to Explore" };
}

/** The topic page a row opens, carrying Your topics as its origin. */
export function topicHref(name: string): string {
  return `/topics/${encodeURIComponent(name)}?from=${FROM_YOUR_TOPICS}`;
}
