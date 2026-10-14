// SAVED'S SEARCH — the one search rule, over the reader's own saved list
// (Saved.md, SavedNone.md; design/readme.md §4 *Search*).
//
// WHY IT RUNS HERE. The rule is the server's (`crates/api/src/search.rs`, the
// one matcher), but Saved ships with the bookmarks contract untouched (jakob,
// round 12: "we are using the same search just over a different set of
// nodes"), and `User.bookmarks` takes no query. So the client holds the whole
// saved set and narrows it by the same rule, clause for clause:
//
// - the query is trimmed; a blank one narrows nothing;
// - only a LEADING `@name` or `#name` is a scope, its name running to the
//   first whitespace;
// - unscoped text matches a person's handle or display name as a
//   case-insensitive substring, and a post's TITLE by word — every word
//   required, the last one as a prefix, so a title refines as it is typed. A
//   comment has no title and is never matched unscoped; an untitled post's
//   stand-in is never matched (titles only, jakob 2026-10-06), and neither is
//   any body, description or bio;
// - `@name text` searches that person's own things: their posts by title and
//   their comments through their thread's root post's title — never the
//   person's own card;
// - `#name text` searches the things that carry the tag, the same way;
// - a BARE scope is a lookup in progress and lists no one's contents: `@x`
//   narrows to the people whose handle starts with `x`, and `#x` to nothing,
//   because a tag is never saved.
//
// Plain TypeScript with no React in it, so the rule is tested as a function.
// Android's twin is `com.cogra.domain.saved.SavedSearch`.

import { previewTagName } from "@/lib/topics/normalize";

/** A query, parsed the way the server's matcher parses it. */
export type ParsedQuery =
  | { readonly kind: "blank" }
  | { readonly kind: "unscoped"; readonly text: string }
  | {
      readonly kind: "scoped";
      readonly scope: "handle" | "tag";
      readonly name: string;
      /** The text after the name; null for a bare scope. */
      readonly remainder: string | null;
    };

/** What one saved thing offers the matcher — its names and titles, never its words. */
export type Searchable =
  | {
      readonly kind: "post";
      readonly authorHandle: string | null;
      /** The post's own title; null when it has none, or its payload went. */
      readonly title: string | null;
      /** The names of the tags the post carries. */
      readonly tags: readonly string[];
    }
  | {
      readonly kind: "comment";
      readonly authorHandle: string | null;
      /** The title of the post at the root of its thread. */
      readonly rootTitle: string | null;
      readonly tags: readonly string[];
    }
  | {
      readonly kind: "person";
      readonly handle: string | null;
      readonly displayName: string | null;
    };

export function parseQuery(raw: string): ParsedQuery {
  const query = raw.trim();
  if (query === "") return { kind: "blank" };
  const sigil = query[0];
  if (sigil !== "@" && sigil !== "#") return { kind: "unscoped", text: query };
  const rest = query.slice(1);
  const split = rest.search(/\s/);
  const name = split === -1 ? rest : rest.slice(0, split);
  const remainder = split === -1 ? null : rest.slice(split).trim() || null;
  return { kind: "scoped", scope: sigil === "@" ? "handle" : "tag", name, remainder };
}

/** A title's words: maximal runs of letters and digits, lowercased. */
export function words(text: string): string[] {
  return [...(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
}

/**
 * Whether `title` answers `query` by word: every word of the query stands in
 * the title, the last one as the prefix of a title word. A query with no word
 * in it matches no title.
 */
export function titleMatches(title: string | null, query: string): boolean {
  if (title === null) return false;
  const asked = words(query);
  if (asked.length === 0) return false;
  const held = words(title);
  const last = asked[asked.length - 1]!;
  return (
    asked.slice(0, -1).every((word) => held.includes(word)) &&
    held.some((word) => word.startsWith(last))
  );
}

function contains(field: string | null, text: string): boolean {
  return field !== null && field.toLowerCase().includes(text.toLowerCase());
}

/** The title a content search reads a thing by: a post's own, a comment's thread's. */
function titleOf(item: Searchable): string | null {
  switch (item.kind) {
    case "post":
      return item.title;
    case "comment":
      return item.rootTitle;
    case "person":
      return null;
  }
}

function unscopedMatch(item: Searchable, text: string): boolean {
  switch (item.kind) {
    case "person":
      return contains(item.handle, text) || contains(item.displayName, text);
    case "post":
      return titleMatches(item.title, text);
    case "comment":
      return false;
  }
}

function scopedMatch(
  item: Searchable,
  scope: "handle" | "tag",
  rawName: string,
  remainder: string | null,
): boolean {
  const name = rawName.toLowerCase();
  if (remainder === null) {
    // A LOOKUP IN PROGRESS: `@x` proposes people, `#x` proposes tags, and
    // neither lists anyone's contents. A tag is never saved.
    if (scope === "tag" || name === "") return false;
    return item.kind === "person" && item.handle !== null && item.handle.toLowerCase().startsWith(name);
  }
  if (item.kind === "person") return false;
  if (scope === "handle") {
    if (item.authorHandle === null || item.authorHandle.toLowerCase() !== name) return false;
  } else {
    const tag = previewTagName(`#${rawName}`);
    if (!tag.valid || !item.tags.some((carried) => carried.toLowerCase() === tag.canonical)) return false;
  }
  return titleMatches(titleOf(item), remainder);
}

/** Whether `item` stands in Saved narrowed by `query`. */
export function matches(item: Searchable, query: ParsedQuery): boolean {
  switch (query.kind) {
    case "blank":
      return true;
    case "unscoped":
      return unscopedMatch(item, query.text);
    case "scoped":
      return scopedMatch(item, query.scope, query.name, query.remainder);
  }
}
