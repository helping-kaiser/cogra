// The client-side reading of a reference target: what class it is, what
// a chip calls it, and where the chip goes (D16, D20). Every destination
// already exists — `/u/[handle]` and `/posts/[id]` — so references add
// components, never a route (D18).
//
// D21: topics are NOT reference targets. Tagging is what a topic is for;
// referencing is for the other passive node classes. A reference points
// at a person's profile — that is a MENTION — or at a post or comment.
//
// The query shapes here MIRROR the finder's own resolution
// (`Query.referenceCandidates`): a handle bare or `@`-sigilled, or a
// UUID for whatever node it addresses. This is a PREVIEW, not a
// validator — it tells the reader what a query will be read as and gates
// the lookup on one that resolves nothing. The server's exact-match
// resolution stays the authority, and an unresolvable query answers with
// an empty list rather than an error.

import type { ReferenceTargetKind, ReferenceTargetView } from "./draft";

/** D7: the creation-batch cap, mirrored client-side (server is authoritative). */
export const REFERENCE_BATCH_CAP = 10;

/** How long a quoted body reads as a chip label before it is elided. */
export const SNIPPET_MAX = 48;

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** What the finder will read a query as; `null` when it resolves nothing. */
export type QueryShape = "handle" | "id" | null;

/**
 * The shape the finder will read a raw query as. A `#`-sigilled query
 * resolves nothing: a topic is tagged, never referenced (D21).
 */
export function queryShape(raw: string): QueryShape {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("#")) return null;
  if (trimmed.startsWith("@")) return trimmed.length > 1 ? "handle" : null;
  if (UUID.test(trimmed)) return "id";
  return "handle";
}

/** Whether a query is worth sending — one that resolves nothing is not. */
export function isQueryable(raw: string): boolean {
  return queryShape(raw) !== null;
}

/** One line of body text, collapsed and elided, as a chip label. */
export function snippet(text: string | null | undefined): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat === "") return "untitled";
  return flat.length <= SNIPPET_MAX ? flat : `${flat.slice(0, SNIPPET_MAX - 1)}…`;
}

/**
 * A `ReferenceTarget` as this client reads it off the wire. Structural
 * rather than a discriminated union on purpose: this is the projection
 * boundary from a GraphQL union whose membership is not this client's to
 * fix, so an unrecognised class falls through to the untyped chip
 * instead of failing to compile.
 */
export type ReferenceTargetNode = {
  readonly __typename: string;
  readonly id?: string;
  /** `User`. */
  readonly handle?: string;
  readonly displayName?: { readonly value?: string | null } | null;
  /** `Post`. */
  readonly title?: { readonly value?: string | null } | null;
  /** `Post`, `Comment`. */
  readonly content?: { readonly value?: string | null } | null;
  readonly author?: { readonly handle: string } | null;
  /** `Comment` — where it hangs, walked up to find the post it reads on. */
  readonly target?: CommentTargetNode;
};

type CommentTargetNode =
  | { readonly __typename: string; readonly id?: string; readonly target?: CommentTargetNode }
  | null
  | undefined;

/**
 * The post a comment reads on. Comment permalinks are a parked item, so
 * a referenced comment opens the post carrying it; a nested reply walks
 * up until it finds one. Null when the selection did not reach a post,
 * which renders as a plain non-navigating chip.
 */
function carryingPost(target: CommentTargetNode): string | null {
  let node = target ?? null;
  while (node !== null && node !== undefined) {
    if (node.__typename === "Post" && node.id !== undefined) return node.id;
    node = node.target ?? null;
  }
  return null;
}

/** An author's handle as a label prefix — "@ada: " — when one is known. */
function attribution(handle: string | null | undefined): string {
  return handle === null || handle === undefined ? "" : `@${handle}: `;
}

/**
 * A typed target projected down to the chip's shape (D16). A `User` is a
 * MENTION and reads as its handle; a `Post` or `Comment` reads as its
 * author plus a snippet. Anything else — a class this client does not
 * render — falls back to the untyped chip.
 */
export function targetView(
  node: ReferenceTargetNode,
  targetId: string,
): ReferenceTargetView {
  switch (node.__typename) {
    case "User": {
      const handle = node.handle;
      if (handle === undefined) break;
      return {
        kind: "User",
        label: `@${handle}`,
        href: `/u/${handle}`,
        handle,
        displayName: node.displayName?.value ?? null,
      };
    }
    case "Post": {
      const title = node.title?.value?.trim();
      const text = title ? title : snippet(node.content?.value);
      return {
        kind: "Post",
        label: `${attribution(node.author?.handle)}${text}`,
        href: node.id === undefined ? null : `/posts/${node.id}`,
      };
    }
    case "Comment": {
      const post = carryingPost(node.target);
      return {
        kind: "Comment",
        label: `${attribution(node.author?.handle)}${snippet(node.content?.value)}`,
        href: post === null ? null : `/posts/${post}`,
      };
    }
  }
  return untypedTargetView(targetId);
}

/**
 * The fallback view for a claim CoGra carries no display row for: the
 * reference stands as a substrate fact whether or not this instance can
 * type its far end (`ReferenceClaim.target` is nullable), so the chip
 * renders off the raw identifier and navigates nowhere.
 */
export function untypedTargetView(targetId: string): ReferenceTargetView {
  return { kind: null, label: targetId, href: null };
}

/** The word for a target class, for labels a reader hears. */
export function targetKindWord(kind: ReferenceTargetKind | null): string {
  switch (kind) {
    case "User":
      return "mention";
    case "Post":
      return "post reference";
    case "Comment":
      return "comment reference";
    default:
      return "reference";
  }
}
