// HOW A ROW NAMES CONTENT THAT HAS NO TITLE OF ITS OWN (design digest items 49
// and 50; B11 for the untitled post's stand-in). First drawn for Saved's rows;
// Saved now stands as a feed of cards, and these names live on where a row or
// a head row still names a thing in one line — the notifications list and the
// comment feed card's head row.

/** The words a removed post's or comment's row carries, in the system's voice. */
export const REMOVED_BY_AUTHOR = "Removed by its author";

type Moderated = { readonly value?: string | null; readonly status: string };

function text(field: Moderated | null | undefined): string {
  return field?.value?.trim() ?? "";
}

function firstLine(words: string): string {
  const trimmed = words.trim();
  const at = trimmed.indexOf("\n");
  return at < 0 ? trimmed : trimmed.slice(0, at).trim();
}

/**
 * B11 (2): a media post (or a wordless comment) is named by what it holds and
 * who made it — `A video by @ada` when it holds a clip, `Pictures by @ada`
 * otherwise.
 */
export function mediaStandIn(
  attachments: readonly { readonly mimeType: string }[],
  handle: string | null,
): string {
  const by = handle === null ? "" : ` by @${handle}`;
  return attachments.some((a) => a.mimeType.startsWith("video/")) ? `A video${by}` : `Pictures${by}`;
}

/** A post's title, or B11's stand-in for an untitled one: its first line, else its media. */
export function postTitle(post: {
  readonly title: Moderated | null | undefined;
  readonly content: Moderated | null | undefined;
  readonly attachments: readonly { readonly mimeType: string }[];
  readonly author?: { readonly handle: string } | null;
}): string {
  const title = text(post.title);
  if (title !== "") return title;
  const words = text(post.content);
  if (words !== "") return firstLine(words);
  return mediaStandIn(post.attachments, post.author?.handle ?? null);
}
