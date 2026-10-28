"use client";

// THE TAG CARD — a topic met in a feed, and a glimpse of what carries it
// (`_shared.jsx` `TagFeedCard`, jakob's pick 2026-10-01; FeedTagShapes.md,
// FeedKinds.md). The lead is the topic's `#` tile beside its name; the body
// is the newest things tagged, their marks side by side and the newest one
// named over its author, so the card reads as a door to a place rather than a
// post inside a header. The card opens the tag's page.
//
// THE ROW READS OPINION · SCORE · THE KIND'S OWN ACT · SHARE (FeedKinds.md):
// the topic's Affinity on the tag page's own words (`AFFINITY_AXES`), the
// score slot waiting with every card's (`post-card.tsx`: no field carries a
// card's score until the ranker's figure reaches the contract), `Tag a new
// post with it` — the composer opened with the tag already staged — and the
// share the tag page's row ends with. A Type has no license, is never cited
// and is never saved, so the card carries no ⋮.
//
// THE WHY-LINE STANDS ONLY WHERE THE TAG REACHES THE READER THROUGH SOMEONE
// (History.md:59: "no history.tagCard.through stands GIVEN the tag reaches
// the reader through no one"). Whom a tag reaches the reader through is the
// strongest paths' people — ranker math (feed-ranking.md §11) no field
// carries yet — so `through` is handed in by the host and every host today
// hands none.
//
// AN EMPTY TAG keeps its card, and its glimpse gives way to one quiet line,
// `Nothing carries this tag right now.`, with no age, since nothing is newest.

import Link from "next/link";
import { useRouter } from "next/navigation";

import { REMOVED_BY_AUTHOR, postTitle } from "@/lib/saved/row-content";
import { Card } from "./card";
import { part, testAttributes, type DataNode } from "./data-node";
import { Icon } from "./icons";
import { NodeMark } from "./node-mark";
import { ShareButton } from "./share-button";
import { StanceControl } from "./stance-control";
import { AFFINITY_AXES } from "./stance-format";
import { shortTimestamp } from "./timestamp";

/** The kind's own act (FeedKinds.md; `_shared.jsx` `TAG_ACT`). */
export const TAG_ACT = "Tag a new post with it";

/** An empty tag's glimpse: `TagPageEmpty`'s own first sentence. */
export const TAG_NOTHING_RECENT = "Nothing carries this tag right now.";

/** How many tagged things the glimpse reads — the board's three marks. */
export const TAG_GLIMPSE_LIMIT = 3;

/** The why-line's own two-name law (`_shared.jsx` `reachesThrough`). */
const WHY_LINE_CHARS = 46;

type Moderated = { readonly value?: string | null; readonly status: string };

type Attachment = {
  readonly url: string;
  readonly status: string;
  readonly mimeType: string;
  readonly coverMedia?: { readonly url: string; readonly status: string } | null;
};

/** A thing the tag carries, as the glimpse reads it. */
export type TaggedThing =
  | {
      readonly __typename: "Post";
      readonly id: string;
      readonly title: Moderated | null;
      readonly content: Moderated | null;
      readonly attachments: readonly Attachment[];
      readonly author: { readonly id: string; readonly handle: string } | null;
      readonly createdAt: string;
    }
  | {
      readonly __typename: "Comment";
      readonly id: string;
      readonly content: Moderated | null;
      readonly author: { readonly id: string; readonly handle: string } | null;
      readonly createdAt: string;
    }
  | { readonly __typename: string };

/** The topic the card draws. */
export type TagCardTopic = {
  readonly id: string;
  readonly name: Moderated;
  readonly taggedContent: readonly { readonly node: TaggedThing }[];
};

type Glimpsed = {
  readonly id: string;
  readonly kind: "post" | "comment";
  readonly title: string;
  readonly cover: string | null;
  readonly removed: boolean;
  readonly handle: string | null;
  readonly createdAt: string;
};

function firstLine(words: string): string {
  const trimmed = words.trim();
  const at = trimmed.indexOf("\n");
  return at < 0 ? trimmed : trimmed.slice(0, at).trim();
}

function glimpsed(thing: TaggedThing): Glimpsed | null {
  if (thing.__typename === "Post" && "attachments" in thing) {
    const removed = thing.content?.status === "REDACTED" || thing.title?.status === "REDACTED";
    const cover = thing.attachments[0];
    const still = cover === undefined || cover.status === "REDACTED"
      ? null
      : cover.mimeType.startsWith("video/")
        ? cover.coverMedia && cover.coverMedia.status !== "REDACTED"
          ? cover.coverMedia.url
          : null
        : cover.url;
    return {
      id: thing.id,
      kind: "post",
      title: removed ? REMOVED_BY_AUTHOR : postTitle(thing),
      cover: removed ? null : still,
      removed,
      handle: thing.author?.handle ?? null,
      createdAt: thing.createdAt,
    };
  }
  if (thing.__typename === "Comment" && "content" in thing && "createdAt" in thing) {
    const removed = thing.content?.status === "REDACTED";
    return {
      id: thing.id,
      kind: "comment",
      title: removed ? REMOVED_BY_AUTHOR : firstLine(thing.content?.value ?? ""),
      cover: null,
      removed,
      handle: thing.author?.handle ?? null,
      createdAt: thing.createdAt,
    };
  }
  return null;
}

/** `Reaches you through @ada and @tobias`, `… @ada and 3 others`, or `Through @ada`. */
export function reachesThrough(handles: readonly string[]): string {
  const named = handles.map((handle) => `@${handle}`);
  const full = `Reaches you through ${
    named.length > 2 ? `${named[0]} and ${named.length - 1} others` : named.join(" and ")
  }`;
  return full.length > WHY_LINE_CHARS ? `Through ${named[0]}` : full;
}

export function TagFeedCard({
  topic,
  from,
  through = [],
  testId,
  node,
  onLinkCopied,
}: {
  topic: TagCardTopic;
  /** The surface the tag page's back arrow names (`history`). */
  from: string;
  /** Whom the tag reaches the reader through — none until the ranker says (History.md:59). */
  through?: readonly string[];
  testId: string;
  /** The registered card (`history.tagCard`); its parts carry the design's ids. */
  node?: DataNode;
  onLinkCopied: () => void;
}) {
  const router = useRouter();
  const name = topic.name.value ?? "";
  const tag = `#${name}`;
  const href = `/topics/${encodeURIComponent(name)}?from=${from}`;
  const things = topic.taggedContent
    .map(({ node: thing }) => glimpsed(thing))
    .filter((thing): thing is Glimpsed => thing !== null)
    .slice(0, TAG_GLIMPSE_LIMIT);
  const newest = things[0];
  const stamp = newest === undefined ? "" : shortTimestamp(newest.createdAt);

  return (
    <Card testId={testId} node={node} door>
      <div className="flex items-center justify-between gap-2">
        {/* THE CARD OPENS THE TAG'S PAGE: one link over the lead, so there is
            one tab stop to it; the row keeps its own meanings. */}
        <Link
          href={href}
          data-testid={`${testId}-link`}
          className="cg-focus cg-door flex min-w-0 items-center gap-2.5"
        >
          <NodeMark kind="topic" node={part(node, "mark")} />
          <span className="flex min-w-0 flex-col">
            <span
              {...testAttributes(part(node, "name"), `${testId}-name`)}
              className="truncate text-label-large"
            >
              {tag}
            </span>
            {through.length > 0 && (
              <span
                {...testAttributes(part(node, "through"), `${testId}-through`)}
                className="truncate text-body-small text-on-surface-variant"
              >
                {reachesThrough(through)}
              </span>
            )}
          </span>
        </Link>
        {stamp !== "" && newest !== undefined && (
          <time
            dateTime={newest.createdAt}
            {...testAttributes(part(node, "timestamp"), `${testId}-timestamp`)}
            className="flex-none text-body-small text-on-surface-variant"
          >
            {stamp}
          </time>
        )}
      </div>
      <Link href={href} tabIndex={-1} aria-hidden="true" className="cg-door block">
        {newest === undefined ? (
          <span
            {...testAttributes(part(node, "nothing"), `${testId}-nothing`)}
            className="text-body-small text-on-surface-variant"
          >
            {TAG_NOTHING_RECENT}
          </span>
        ) : (
          <span
            {...testAttributes(part(node, "glimpse"), `${testId}-glimpse`)}
            className="flex min-w-0 items-center gap-3"
          >
            <span className="flex flex-none gap-1">
              {things.map((thing) => (
                <NodeMark key={thing.id} kind={thing.kind} src={thing.cover} redacted={thing.removed} />
              ))}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                {...testAttributes(part(node, "glimpse.newest"), `${testId}-newest`)}
                className="truncate text-label-large"
              >
                {newest.title}
              </span>
              <span
                {...testAttributes(part(node, "glimpse.by"), `${testId}-by`)}
                className="text-body-small text-on-surface-variant"
              >
                {newest.handle === null ? "" : `@${newest.handle}`}
                {things.length > 1 && ` · and ${things.length - 1} more`}
              </span>
            </span>
          </span>
        )}
      </Link>
      <div
        {...testAttributes(part(node, "actionRow"), `${testId}-affordances`)}
        className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2"
      >
        {/* A name moderation took away is a topic with nothing to stance
            toward: the canonical name IS the target's identity (the tag
            page's own rule). */}
        {name !== "" && (
          <StanceControl
            target={{ id: name, kind: "topic", label: tag }}
            testIdPrefix={`${testId}-stance`}
            axes={AFFINITY_AXES}
            node={part(node, "actionRow.stance")}
          />
        )}
        <button
          type="button"
          aria-label={TAG_ACT}
          onClick={() => router.push(`/compose?tag=${encodeURIComponent(name)}`)}
          {...testAttributes(part(node, "actionRow.compose"), `${testId}-compose`)}
          className="cg-state cg-focus cg-hit flex flex-none items-center rounded-full border-0 bg-transparent px-2 py-1.5 text-on-surface-variant"
        >
          <Icon name="add" size={18} />
        </button>
        <ShareButton
          href={`/topics/${encodeURIComponent(name)}`}
          targetLabel={tag}
          onCopied={onLinkCopied}
          testId={`${testId}-share`}
          node={part(node, "actionRow.share")}
        />
      </div>
    </Card>
  );
}
