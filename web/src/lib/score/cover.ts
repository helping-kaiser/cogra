// THE THING THE SCORE BELONGS TO, held above all four levels (ScoreOrigin,
// `_shared.jsx`; FeedEntryKinds.md:5-7): one top block per kind, in the words
// its own card already uses (`QuotedRow`'s rule) —
//
// - a post by its title and its author's handle, over how it starts;
// - a comment by its author's handle over its first words;
// - a person by their name over their handle;
// - a tag by its name beside its `#` tile.
//
// A SENSITIVE THING SHOWS ITS ADDRESS ONLY, never its body (SR-G17's build
// reading: the whole-body veil, readme §9); A REMOVED ONE ITS MARK'S OWN
// WORDS in the body's place — the removed words never reach a cover.

import { bodyIsSensitive, payloadIsRedacted, removalReason } from "@/lib/ui/post-media";
import type { TraceThingKind } from "./trace-model";

export type TraceCover = {
  readonly kind: TraceThingKind;
  readonly title: string;
  readonly snippet: string | null;
  /** The face the row leads with; null for a tag, which wears its `#` tile. */
  readonly disc: { readonly name: string; readonly src: string | null } | null;
  /** When the thing was made — a publish step's age (RankPath.md:11). */
  readonly createdAt: string | null;
};

type Author = {
  readonly handle: string;
  readonly displayName: { readonly value?: string | null };
  readonly avatar?: { readonly url: string } | null;
} | null;

type Text = { readonly value?: string | null; readonly status: string };

/** What a post card and the detail both hold (`PostFields`). */
export type CoverPost = Parameters<typeof payloadIsRedacted>[0] & {
  readonly title: Text;
  readonly content: Text;
  readonly description: Text;
  readonly author?: Author;
  readonly createdAt: string;
};

const REMOVED_WORDS = {
  author: "Removed by its author",
  platform: "Removed under the platform's rules",
} as const;

function words(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function discOf(author: Author): TraceCover["disc"] {
  if (author === null || author === undefined) return { name: "", src: null };
  return { name: author.displayName.value ?? author.handle, src: author.avatar?.url ?? null };
}

/** A post's cover: `The long way home — @ada` over how it starts. */
export function postCover(post: CoverPost): TraceCover {
  const handle = post.author ? `@${post.author.handle}` : "Deleted account";
  const redacted = payloadIsRedacted(post);
  const title = redacted ? null : words(post.title.value);
  return {
    kind: "post",
    title: title === null ? handle : `${title} — ${handle}`,
    snippet: redacted
      ? REMOVED_WORDS[removalReason(post)]
      : bodyIsSensitive(post)
        ? null
        : (words(post.content.value) ?? words(post.description.value)),
    disc: discOf(post.author ?? null),
    createdAt: post.createdAt,
  };
}

/** A comment's cover: its author's handle over its first words. */
export function commentCover(comment: {
  readonly content: Text;
  readonly author?: Author;
  readonly createdAt?: string | null;
}): TraceCover {
  return {
    kind: "comment",
    title: comment.author ? `@${comment.author.handle}` : "Deleted account",
    snippet: comment.content.status === "REDACTED" ? REMOVED_WORDS.author : words(comment.content.value),
    disc: discOf(comment.author ?? null),
    createdAt: comment.createdAt ?? null,
  };
}

/** A person's cover: their name over their handle. */
export function personCover(person: NonNullable<Author>): TraceCover {
  return {
    kind: "person",
    title: person.displayName.value ?? `@${person.handle}`,
    snippet: `@${person.handle}`,
    disc: discOf(person),
    createdAt: null,
  };
}

/** A tag's cover: its name beside its `#` tile. */
export function topicCover(name: string): TraceCover {
  return { kind: "topic", title: `#${name}`, snippet: null, disc: null, createdAt: null };
}
