// WHAT A SAVED ROW SAYS (Saved.md; design digest items 49 and 50; B11 for the
// untitled post's stand-in). A pure reading of one kept node into ContentRow's
// slots, so every rule below is pinned by a test of its own rather than by a
// screen.
//
// - A post: its kind's glyph, the title (else B11's stand-in), the author's
//   handle as the aside, and one second line — a titled words post's words, a
//   titled media post's description, an untitled words post's remaining words,
//   an untitled media post nothing.
// - A comment: the glyph, its first line as the title (a wordless comment
//   takes the media stand-in), the handle, and `on <thread's post>`.
// - A person: their picture, else their monogram; the display name (else the
//   handle, with no aside); the bio, or nothing.
// - The aside drops wherever the title already names the handle.
// - What changed stays and reads through its own status: a removed or
//   redacted post or comment reads `Removed by its author` in the system's
//   voice, a deleted account the reserved disc and `Deleted account`, and a
//   sensitive thing keeps its title while the second line gives way to the
//   reason.

import type { SavedNode } from "@/lib/api/saved-api";
import type { ContentRowDisc } from "@/lib/ui2/content-row";

/** The words a removed post's or comment's row carries, in the system's voice. */
export const REMOVED_BY_AUTHOR = "Removed by its author";

export type SavedRowContent = {
  readonly title: string;
  readonly titleQuiet: boolean;
  readonly aside: string | undefined;
  readonly second: string | undefined;
  readonly disc: ContentRowDisc;
  /** The key `saved.list.entry` wears: the title's slug. */
  readonly key: string;
  /** Where the row opens. */
  readonly href: string;
  /** The words the row's Unsave names (`Unsave <title>`). */
  readonly name: string;
};

type Moderated = { readonly value?: string | null; readonly status: string };

function text(field: Moderated | null | undefined): string {
  return field?.value?.trim() ?? "";
}

function redacted(field: Moderated | null | undefined): boolean {
  return field?.status === "REDACTED";
}

/** Words run onto one line; the row's own ellipsis does the cutting. */
function oneLine(words: string): string {
  return words.replace(/\s+/g, " ").trim();
}

function firstLine(words: string): { head: string; rest: string } {
  const trimmed = words.trim();
  const at = trimmed.indexOf("\n");
  if (at < 0) return { head: trimmed, rest: "" };
  return { head: trimmed.slice(0, at).trim(), rest: trimmed.slice(at + 1).trim() };
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

/**
 * The saved-list key (seam 066): lowercased, each run of other characters one
 * `-`, nothing leading or trailing.
 */
export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** A post's title, or B11's stand-in for an untitled one. */
export function postTitle(post: {
  readonly title: Moderated;
  readonly content: Moderated;
  readonly attachments: readonly { readonly mimeType: string }[];
  readonly author?: { readonly handle: string } | null;
}): string {
  const title = text(post.title);
  if (title !== "") return title;
  const words = text(post.content);
  if (words !== "") return firstLine(words).head;
  return mediaStandIn(post.attachments, post.author?.handle ?? null);
}

function sensitiveReason(node: { moderationStatus: string; sensitiveReason?: string | null }) {
  if (node.moderationStatus !== "SENSITIVE") return undefined;
  const reason = node.sensitiveReason?.trim();
  return reason === undefined || reason === "" ? undefined : reason;
}

export function savedRow(node: SavedNode): SavedRowContent | null {
  switch (node.__typename) {
    case "Post": {
      const handle = node.author?.handle ?? null;
      const href = `/posts/${node.id}?from=saved`;
      if (redacted(node.title) || redacted(node.content)) {
        return removedRow(node.id, href, "dynamic_feed");
      }
      const media = node.attachments.length > 0;
      const titled = text(node.title) !== "";
      const words = text(node.content);
      const title = postTitle(node);
      let second: string | undefined;
      if (titled) second = media ? oneLine(text(node.description)) : oneLine(words);
      else if (!media) second = oneLine(firstLine(words).rest);
      const aside = handle === null || title.includes(`@${handle}`) ? undefined : `@${handle}`;
      return {
        title,
        titleQuiet: false,
        aside,
        second: sensitiveReason(node) ?? (second === "" ? undefined : second),
        disc: { kind: "glyph", glyph: "dynamic_feed" },
        key: slug(title),
        href,
        name: title,
      };
    }
    case "Comment": {
      const handle = node.author?.handle ?? null;
      const post = node.post ?? null;
      const href =
        post === null
          ? `/posts/${node.id}?from=saved`
          : `/posts/${post.id}?comment=${node.id}&from=saved`;
      if (redacted(node.content)) return removedRow(node.id, href, "chat_bubble");
      const words = text(node.content);
      const title = words !== "" ? firstLine(words).head : mediaStandIn(node.attachments, handle);
      const aside = handle === null || title.includes(`@${handle}`) ? undefined : `@${handle}`;
      const on = post === null ? undefined : `on ${postTitle(post)}`;
      return {
        title,
        titleQuiet: false,
        aside,
        second: sensitiveReason(node) ?? on,
        disc: { kind: "glyph", glyph: "chat_bubble" },
        key: slug(title),
        href,
        name: title,
      };
    }
    case "User": {
      const href = `/u/${node.handle}?from=saved`;
      if (redacted(node.displayName)) {
        return {
          title: "",
          titleQuiet: true,
          aside: undefined,
          second: undefined,
          disc: { kind: "redacted" },
          key: node.id,
          href,
          name: "Deleted account",
        };
      }
      const name = text(node.displayName);
      const title = name !== "" ? name : `@${node.handle}`;
      const bio = text(node.bio);
      const picture = node.avatar?.url && node.avatar.status !== "REDACTED" ? node.avatar.url : null;
      return {
        title,
        titleQuiet: false,
        aside: name !== "" ? `@${node.handle}` : undefined,
        second: bio === "" ? undefined : oneLine(bio),
        disc: picture !== null ? { kind: "picture", src: picture, name: title } : { kind: "monogram", name: title },
        key: slug(name !== "" ? name : node.handle),
        href,
        name: title,
      };
    }
    default:
      return null;
  }
}

function removedRow(id: string, href: string, glyph: "dynamic_feed" | "chat_bubble"): SavedRowContent {
  return {
    title: REMOVED_BY_AUTHOR,
    titleQuiet: true,
    aside: undefined,
    second: undefined,
    disc: { kind: "glyph", glyph },
    key: id,
    href,
    name: REMOVED_BY_AUTHOR,
  };
}
