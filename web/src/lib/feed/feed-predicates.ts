// THE POST-RANK PREDICATES (ranked-feed packet CD-4: "forms, sensitive,
// removed and hidden, one predicate set"; feed-ranking.md §9.1, "hard
// exclusions are post-rank frontend filters"). What the sheet's Kinds of post
// and Also show chips cut from a derived list, read off a HYDRATED row — the
// ranking names a row's id and kind, and only its card says what form it
// takes, whether it is veiled, or whether its payload has gone.
//
// Each applies where it means something:
// - KINDS OF POST to a post and a comment, the two kinds that carry a body
//   (FeedFilter.jsx: "Applies once posts or comments are in"). Words alone are
//   `text`, a clip anywhere makes it `video`, pictures make it `photos`.
// - SENSITIVE to a post and a comment whose body is veiled
//   (`bodyIsSensitive`). Off, the feed admits none (FeedSheet.md:43); on, they
//   stand veiled the Settings way ("How sensitive content is veiled is set in
//   Settings.").
// - REMOVED to a post and a comment whose payload went (`payloadIsRedacted`,
//   which keys on the node's `removal` first). Off, the feed admits none; on,
//   each stands as its mark.
// A person and a topic carry none of these, so no chip here cuts them.
//
// Hidden people are the fourth predicate, and stay the screen's own: a hide's
// Undo must put a row back where it stood, so the list keeps hidden rows and
// the screen draws past them (hidden-actors §4.4; `RankedFeed.window`).

import { bodyIsSensitive, payloadIsRedacted } from "@/lib/ui/post-media";
import type { FeedFilterValue, FeedFormValue } from "./feed-filter";

type Bodied = Parameters<typeof payloadIsRedacted>[0];

/** A hydrated row, as far as the predicates read it. */
export type PredicateItem = { readonly __typename: string } & Partial<Bodied>;

function hasBody(item: PredicateItem): item is PredicateItem & Bodied {
  return (
    (item.__typename === "Post" || item.__typename === "Comment") &&
    Array.isArray(item.attachments) &&
    typeof item.attachmentsStatus === "string"
  );
}

/** The form a body takes: a clip anywhere is video, pictures photos, none text. */
export function formOf(item: Bodied): FeedFormValue {
  if (item.attachments.length === 0) return "text";
  return item.attachments.some((attachment) => attachment.mimeType.startsWith("video/")) ? "video" : "photos";
}

/** Whether `filter` admits the hydrated row `item`. */
export function admitsItem(filter: FeedFilterValue, item: PredicateItem): boolean {
  if (!hasBody(item)) return true;
  if (!filter.also.includes("removed") && payloadIsRedacted(item)) return false;
  // A removed body has no form and no veil left to read: Removed alone decides it.
  if (payloadIsRedacted(item)) return true;
  if (!filter.also.includes("sensitive") && bodyIsSensitive(item)) return false;
  return filter.forms.includes(formOf(item));
}
