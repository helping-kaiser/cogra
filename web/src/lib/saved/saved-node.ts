// What a kept thing offers Saved's search: its names and titles, read off the
// card's own selection (`saved.graphql`), and never its words.
//
// A payload that went — a removed post's title, a deleted account's name —
// offers nothing to match: what the card no longer shows, a search must not
// find it by.

import type { SavedNode } from "@/lib/api/saved-api";
import type { Searchable } from "./saved-search";

type Moderated = { readonly value?: string | null; readonly status: string } | null | undefined;

/** A field's text while its payload stands; null once it went or was never set. */
function shown(field: Moderated): string | null {
  if (field === null || field === undefined || field.status === "REDACTED") return null;
  const value = field.value?.trim() ?? "";
  return value === "" ? null : value;
}

/** The names of the tags a thing's own author carries it with (relevance 0 is a withdrawal). */
function carried(
  topics: readonly { readonly relevance: number; readonly hashtag: { readonly name: Moderated } }[],
): string[] {
  return topics
    .filter((claim) => claim.relevance !== 0)
    .map((claim) => shown(claim.hashtag.name))
    .filter((name): name is string => name !== null);
}

export function searchableOf(node: SavedNode): Searchable | null {
  switch (node.__typename) {
    case "Post":
      return {
        kind: "post",
        authorHandle: node.author?.handle ?? null,
        title: shown(node.title),
        tags: carried(node.topics),
      };
    case "Comment":
      return {
        kind: "comment",
        authorHandle: node.author?.handle ?? null,
        rootTitle: shown(node.post?.title),
        tags: carried(node.topics),
      };
    case "User":
      return {
        kind: "person",
        handle: shown(node.displayName) === null && node.displayName?.status === "REDACTED" ? null : node.handle,
        displayName: shown(node.displayName),
      };
    default:
      return null;
  }
}
