// HOW EXPLORE DRAWS THE SEARCH'S ANSWER — pure, so every sidecar line it
// carries is a function a test can state (ExploreSearch.md, ExplorePerson.md,
// ExploreUnscoped.md, ExploreNone.md; design/readme.md §13, the search-law
// round).
//
// THE ANSWER IS DRAWN IN THE ORDER SERVED, NEVER RE-SORTED. The server
// sections it — people, then topics, then content — and orders each section
// (api-spec.md "Search", *Order*); this module only decides how each row
// reads and what stands between them:
//
// - the people section's caption, `Profiles`, and its `See all profiles`
//   door (ExplorePerson.md:3-9), unless Profiles alone is the filter's kind
//   (:15);
// - under RANKED, the seam before the first row the ranker could not score,
//   in each section — the sections stand under ranking too, each its ranked
//   head and then its own rest behind the seam (api-spec "Order");
// - each row's right edge: the viewer-relative rank beside the graph glyph
//   while scored (ExploreSearch.md:13), else its age in the one ladder for a
//   post or a comment (:9, :75), and nothing for a tag or a person (:11, :77).

import type { FeedKindValue } from "@/lib/feed/feed-filter";
import type { SearchHit, SearchNode } from "@/lib/api/search-api";
import { ladderAge } from "@/lib/ui/timestamp";
import type { SearchOrder } from "./search-filter";

/** ExploreNone.md:3, verbatim. */
export const NOTHING_CARRIES_THAT_NAME =
  "Nothing carries that name. Search reads names and titles, never bodies — fewer words reach further.";

/** ExploreUnscoped.md:3, the search-scope line (copy-voice.md, blessed 2026-10-06). */
export const FOUND_THROUGH_PEOPLE_AND_TAGS = "Found through people and tags — start with @handle or #tag.";

/** ExplorePerson.md:3. */
export const PROFILES_LABEL = "Profiles";

/** ExplorePerson.md:7. */
export const SEE_ALL_PROFILES = "See all profiles";

/** The seam's words (copy-voice.md, Explore's carried-over words). */
export const BEYOND_YOUR_REACH = "Beyond your reach — newest first";

/** Where a drill-in opened from a search says it came from (`back-origin.ts`). */
export const SEARCH_ORIGIN = "search";

export type ResultKind = "post" | "comment" | "person" | "topic";
export type Section = "people" | "topics" | "content";

export type ResultRow = {
  readonly type: "row";
  /** The row's position in the results, from 1 — the registry's key. */
  readonly position: number;
  readonly id: string;
  readonly kind: ResultKind;
  readonly section: Section;
  readonly name: string;
  readonly sub: string | null;
  /** A post's cover or a person's picture; null draws the kind's tile or monogram. */
  readonly src: string | null;
  /** The viewer-relative rank, as drawn (`9.10`). */
  readonly rank: string | null;
  /** The plain value edge: an age. */
  readonly value: string | null;
  /** Where the row opens; null when it can open nothing. */
  readonly href: string | null;
};

export type ResultItem =
  | ResultRow
  | { readonly type: "profilesLabel" }
  | { readonly type: "profilesDoor" }
  | { readonly type: "seam"; readonly section: Section };

/** A leading `@` or `#` and the word it names (api-spec "Cues"); elsewhere they are text. */
export type Cue = { readonly sigil: "@" | "#"; readonly name: string; readonly scoped: boolean };

export function cueOf(query: string): Cue | null {
  const asked = query.trim();
  const sigil = asked.charAt(0);
  if (sigil !== "@" && sigil !== "#") return null;
  const [head = "", ...rest] = asked.slice(1).split(/\s+/);
  return { sigil, name: head, scoped: rest.join(" ").trim() !== "" };
}

/**
 * Comments are served only under a cue (ExploreSearch.md:29), so with
 * Comments on and no `@handle` or `#tag`, the search-scope line stands
 * (ExploreUnscoped.md:3-7).
 */
export function unscopedComments(query: string, kinds: readonly FeedKindValue[]): boolean {
  return query.trim() !== "" && kinds.includes("comments") && cueOf(query) === null;
}

/** Comments alone and no cue: no row can stand, so nothing need be asked. */
export function onlyUnscopedComments(query: string, kinds: readonly FeedKindValue[]): boolean {
  return unscopedComments(query, kinds) && kinds.length === 1;
}

function sectionOf(node: SearchNode): Section {
  switch (node.__typename) {
    case "User":
      return "people";
    case "Hashtag":
      return "topics";
    default:
      return "content";
  }
}

function withFrom(path: string, query: string | null = null): string {
  return `${path}?${query === null ? "" : `${query}&`}from=${SEARCH_ORIGIN}`;
}

/** A post's cover, unless its media is classified: then the text tile (ExploreSearch.md:49). */
function coverOf(node: Extract<SearchNode, { __typename: "Post" }>): string | null {
  if (node.attachmentsStatus !== "NORMAL") return null;
  const first = node.attachments[0];
  if (first === undefined || first.status !== "NORMAL") return null;
  if (first.coverMedia != null) return first.coverMedia.status === "NORMAL" ? first.coverMedia.url : null;
  return first.mimeType.startsWith("image/") ? first.url : null;
}

/** The rank as the row draws it — two places, the board's `9.10`. */
export function formatRank(score: number): string {
  return score.toFixed(2);
}

type RowContext = {
  readonly query: string;
  readonly reader: string | null;
  readonly order: SearchOrder;
  readonly now: number;
};

function rowOf(hit: SearchHit, position: number, context: RowContext): ResultRow {
  const { node, score } = hit;
  const ranked = context.order === "ranked" && score !== null;
  const dated = (createdAt: string) => (ranked ? null : ladderAge(createdAt, context.now));
  const rank = ranked ? formatRank(score) : null;
  const base = { type: "row" as const, position, id: node.id, section: sectionOf(node), rank };
  switch (node.__typename) {
    case "Post":
      return {
        ...base,
        kind: "post",
        name: node.title.value ?? "",
        sub: null,
        src: coverOf(node),
        value: dated(node.createdAt),
        href: withFrom(`/posts/${encodeURIComponent(node.id)}`),
      };
    case "Comment": {
      const title = node.post?.title.value ?? null;
      return {
        ...base,
        kind: "comment",
        name: node.content.value ?? "",
        // The indirect line names the title it was found through (:31, :45).
        sub: title === null ? null : `on ${title}`,
        src: null,
        value: dated(node.createdAt),
        // Search-into-a-thread: the thread opens landed on the comment
        // (design/readme.md, *Landing on a comment*).
        href:
          node.post == null
            ? null
            : withFrom(`/posts/${encodeURIComponent(node.post.id)}`, `comment=${encodeURIComponent(node.id)}`),
      };
    }
    case "User":
      return {
        ...base,
        kind: "person",
        name: node.displayName.value ?? `@${node.handle}`,
        sub: `@${node.handle}`,
        src: node.avatar?.status === "NORMAL" ? node.avatar.url : null,
        value: null,
        // The reader's own row opens their own profile (ExplorePerson.md:25).
        href:
          context.reader !== null && node.id === context.reader
            ? "/profile"
            : withFrom(`/u/${encodeURIComponent(node.handle)}`),
      };
    case "Hashtag": {
      const cue = cueOf(context.query);
      const name = node.name.value ?? "";
      return {
        ...base,
        kind: "topic",
        name,
        // Reached through a person cue, a tag says by whom (ExploreSearch.md:43).
        sub: cue?.sigil === "@" && cue.name !== "" ? `tagged by @${cue.name}` : null,
        src: null,
        value: null,
        href: name === "" ? null : withFrom(`/topics/${encodeURIComponent(name)}`),
      };
    }
  }
}

export type ResultsLayout = {
  readonly query: string;
  readonly hits: readonly SearchHit[];
  readonly kinds: readonly FeedKindValue[];
  readonly order: SearchOrder;
  readonly hasMorePeople: boolean;
  /** The signed-in reader's id; null for a guest. */
  readonly reader: string | null;
  readonly now?: number;
};

/** The results region, top to bottom. */
export function layoutResults({
  query,
  hits,
  kinds,
  order,
  hasMorePeople,
  reader,
  now = Date.now(),
}: ResultsLayout): ResultItem[] {
  const context: RowContext = { query, reader, order, now };
  const profilesAlone = kinds.length === 1 && kinds[0] === "profiles";
  const items: ResultItem[] = [];
  let position = 0;
  let previous: Section | null = null;
  let seamed = false;
  for (const hit of hits) {
    const section = sectionOf(hit.node);
    if (section !== previous) {
      // The people section closes with its door, where more match (:7).
      if (previous === "people" && hasMorePeople && !profilesAlone) items.push({ type: "profilesDoor" });
      if (section === "people" && !profilesAlone) items.push({ type: "profilesLabel" });
      previous = section;
      seamed = false;
    }
    if (order === "ranked" && hit.score === null && !seamed) {
      items.push({ type: "seam", section });
      seamed = true;
    }
    position += 1;
    items.push(rowOf(hit, position, context));
  }
  if (previous === "people" && hasMorePeople && !profilesAlone) items.push({ type: "profilesDoor" });
  return items;
}
