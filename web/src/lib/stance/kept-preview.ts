// WHAT A KEPT PICK'S ROW NAMES ITS TARGET BY (KeptPicksReview.md;
// `StagedReference`'s `kind`, `name`, `sub`, `src` and `removed`). The review
// lists one row per kept pick — the target's mark (a post's cover, a person's
// circle), what it is on, its kind on the second line — read live when the
// review opens.
//
// A TARGET REMOVED WHILE ITS PICK WAITED keeps its row: nothing leaves the
// graph, so the pick still signs, but the row wears the removed-mark face in
// place of a live preview — the tile empty, the mark in the name's place in
// the system's voice (KeptPicksReview.md:9; readme "The kept picks, ruled").

import { postTitle, REMOVED_BY_AUTHOR } from "@/lib/saved/row-content";
import { REDACTED_ACTOR_NAME } from "@/lib/ui2/content-row";
import type { StanceTarget } from "./stance-data";

/** `NodeMark`'s kinds as the row draws them: a person is a circle, the rest tiles. */
export type KeptMarkKind = "post" | "comment" | "person" | "topic";

export type KeptTargetPreview = {
  readonly kind: KeptMarkKind;
  /** What the pick is on, in the reader's words (`The long way home — @ada`). */
  readonly name: string;
  /** The kind word on the second line (`Post`, `Person`). */
  readonly sub: string;
  /** A post's cover or a person's picture, for the mark; null draws the kind's own. */
  readonly src: string | null;
  /** The removal mark, standing where the name stood; null for a live target. */
  readonly removed: string | null;
};

/**
 * Who removed a payload — `RemovalAgent` (api-spec.md "Removal"). Not served
 * yet: the branch below is built against its shape and stays inert until the
 * field lands on the reads.
 */
export type RemovalAgent = "AUTHOR" | "ACCOUNT" | "MODERATION";

/**
 * A removal's mark in the system's voice. AUTHOR and ACCOUNT both read
 * `Removed by its author` (api-spec.md: "the data keeps them distinct"); a
 * moderation verdict is the post-MVP half and has no blessed words yet, so it
 * reads as the author's until it does.
 */
export function removalMark(removal: { readonly by: RemovalAgent } | null | undefined): string | null {
  if (removal === null || removal === undefined) return null;
  return REMOVED_BY_AUTHOR;
}

type Moderated = { readonly value?: string | null; readonly status: string } | null | undefined;

type WirePost = {
  readonly title: Moderated;
  readonly content: Moderated;
  readonly attachments: readonly {
    readonly url: string;
    readonly status: string;
    readonly mimeType: string;
    readonly coverMedia?: { readonly url: string; readonly status: string } | null;
  }[];
  readonly author?: { readonly handle: string } | null;
  readonly removal?: { readonly by: RemovalAgent } | null;
};

type WireComment = {
  readonly content: Moderated;
  readonly author?: { readonly handle: string } | null;
  readonly removal?: { readonly by: RemovalAgent } | null;
};

type WireProfile = {
  readonly handle: string;
  readonly displayName: Moderated;
  readonly avatar?: { readonly url: string; readonly status: string } | null;
};

const byline = (author: { readonly handle: string } | null | undefined) =>
  author ? ` — @${author.handle}` : "";

/** A post's row: its title (or B11's stand-in) and its author, its cover as the tile. */
export function postPreview(post: WirePost): KeptTargetPreview {
  const lead = post.attachments[0];
  const cover =
    lead === undefined
      ? null
      : lead.mimeType.startsWith("video/")
        ? lead.coverMedia?.status === "REDACTED"
          ? null
          : (lead.coverMedia?.url ?? null)
        : lead.status === "REDACTED"
          ? null
          : lead.url;
  return {
    kind: "post",
    name: `${postTitle(post)}${byline(post.author)}`,
    sub: "Post",
    src: cover,
    removed: removalMark(post.removal),
  };
}

/** A comment's row: its first line and its author. */
export function commentPreview(comment: WireComment): KeptTargetPreview {
  const words = (comment.content?.value ?? "").trim();
  const at = words.indexOf("\n");
  const first = at < 0 ? words : words.slice(0, at).trim();
  return {
    kind: "comment",
    name: `${first === "" ? "A comment" : first}${byline(comment.author)}`,
    sub: "Comment",
    src: null,
    removed: removalMark(comment.removal),
  };
}

/** A person's row: their name, or their handle; a deleted account reads its mark. */
export function profilePreview(user: WireProfile): KeptTargetPreview {
  const deleted = user.displayName?.status === "REDACTED";
  const name = (user.displayName?.value ?? "").trim();
  return {
    kind: "person",
    name: name === "" ? `@${user.handle}` : name,
    sub: "Person",
    src: deleted || user.avatar?.status === "REDACTED" ? null : (user.avatar?.url ?? null),
    removed: deleted ? REDACTED_ACTOR_NAME : null,
  };
}

/** A topic is its own name; nothing to read. */
export function topicPreview(target: StanceTarget): KeptTargetPreview {
  return { kind: "topic", name: `#${target.id}`, sub: "Topic", src: null, removed: null };
}

/**
 * A target whose read did not answer still has its row — the pick is real —
 * named by its kind alone until a read does.
 */
export function fallbackPreview(target: StanceTarget): KeptTargetPreview {
  switch (target.kind) {
    case "post":
      return { kind: "post", name: "A post", sub: "Post", src: null, removed: null };
    case "comment":
      return { kind: "comment", name: "A comment", sub: "Comment", src: null, removed: null };
    case "profile":
      return { kind: "person", name: "A person", sub: "Person", src: null, removed: null };
    case "topic":
      return topicPreview(target);
  }
}
