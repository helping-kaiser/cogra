// The client-side reading of a reference target: what class it is, what
// a chip calls it, and where the chip goes (D16, D20). Every destination
// already exists — `/u/[handle]`, `/posts/[id]`, `/topics/[name]` — so
// references add components, never a route (D18).
//
// The query shapes here MIRROR the finder's own resolution
// (`Query.referenceCandidates`): a handle bare or `@`-sigilled, a
// `#name` for a topic, a UUID for whatever node it addresses. This is a
// PREVIEW, not a validator — it tells the reader what a query will be
// read as and gates the lookup on an obviously-empty one. The server's
// exact-match resolution stays the authority, and an unresolvable query
// answers with an empty list rather than an error.

import type { ReferenceTargetKind, ReferenceTargetView } from "./draft";

/** D7: the creation-batch cap, mirrored client-side (server is authoritative). */
export const REFERENCE_BATCH_CAP = 10;

/** How long a quoted body reads as a chip label before it is elided. */
export const SNIPPET_MAX = 48;

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** What the finder will read a query as; `null` when it resolves nothing. */
export type QueryShape = "handle" | "topic" | "id" | null;

/**
 * The shape the finder will read a raw query as. Order matters: the
 * sigils are unambiguous, a bare UUID is next, and anything else left
 * over is tried as a handle — which is what the server does too.
 */
export function queryShape(raw: string): QueryShape {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("#")) return trimmed.length > 1 ? "topic" : null;
  if (trimmed.startsWith("@")) return trimmed.length > 1 ? "handle" : null;
  if (UUID.test(trimmed)) return "id";
  return "handle";
}

/** Whether a query is worth sending — an empty one resolves nothing. */
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
 * The `ReferenceTarget` union as this client reads it, structurally —
 * so the projection is testable without the generated types and stays
 * one function for claims and candidates alike.
 */
export type ReferenceTargetNode =
  | {
      readonly __typename: "User";
      readonly handle: string;
      readonly displayName?: { readonly value?: string | null } | null;
    }
  | {
      readonly __typename: "Hashtag";
      readonly name?: { readonly value?: string | null } | null;
    }
  | {
      readonly __typename: "Post";
      readonly id: string;
      readonly title?: { readonly value?: string | null } | null;
      readonly content?: { readonly value?: string | null } | null;
      readonly author?: { readonly handle: string } | null;
    }
  | {
      readonly __typename: "Comment";
      readonly id: string;
      readonly content?: { readonly value?: string | null } | null;
      readonly author?: { readonly handle: string } | null;
      /** Where the comment hangs — walked up to find the post it reads on. */
      readonly target?: CommentTargetNode | null;
    };

type CommentTargetNode =
  | { readonly __typename: "Post"; readonly id: string }
  | { readonly __typename: "Comment"; readonly target?: CommentTargetNode | null }
  | null;

/**
 * The post a comment reads on. Comment permalinks are a parked item, so
 * a referenced comment opens the post carrying it; a nested reply walks
 * up until it finds one. Null when the selection did not reach a post,
 * which renders as a plain non-navigating chip.
 */
function carryingPost(target: CommentTargetNode | null | undefined): string | null {
  let node = target ?? null;
  while (node !== null) {
    if (node.__typename === "Post") return node.id;
    node = node.target ?? null;
  }
  return null;
}

/** An author's handle as a label prefix — "@ada: " — when one is known. */
function attribution(handle: string | null | undefined): string {
  return handle === null || handle === undefined ? "" : `@${handle}: `;
}

/**
 * A typed target projected down to the chip's shape (D16). A `User` is
 * a MENTION and reads as its handle; a `Hashtag` reads as `#name`; a
 * `Post` or `Comment` reads as its author plus a snippet.
 */
export function targetView(node: ReferenceTargetNode): ReferenceTargetView {
  switch (node.__typename) {
    case "User": {
      return {
        kind: "User",
        label: `@${node.handle}`,
        href: `/u/${node.handle}`,
      };
    }
    case "Hashtag": {
      const name = node.name?.value ?? "";
      return {
        kind: "Hashtag",
        label: `#${name}`,
        href: name === "" ? null : `/topics/${name}`,
      };
    }
    case "Post": {
      const title = node.title?.value?.trim();
      const text = title ? title : snippet(node.content?.value);
      return {
        kind: "Post",
        label: `${attribution(node.author?.handle)}${text}`,
        href: `/posts/${node.id}`,
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
}

/**
 * The fallback view for a claim CoGra carries no display row for: the
 * citation stands as a substrate fact whether or not this instance can
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
    case "Hashtag":
      return "topic reference";
    case "Post":
      return "post reference";
    case "Comment":
      return "comment reference";
    default:
      return "reference";
  }
}
