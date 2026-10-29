"use client";

// THE STREAM'S RAIL (`design/components/media/ReelRail.jsx`; readme §13, the
// reel round) — the post card's action row turned on its side and laid over
// the clip.
//
// THE ORDER IS RULED, top to bottom: author · opinion · comments · share · the
// score (Reel.md:19). People lead; then the acts in the card's own order; THE
// SCORE SITS LAST "because it is the door out of the stream: a thumb reaching
// for the opinion never passes over the exit" (ReelRail.jsx:10-15). Topics,
// the reference count and the reader's ⋮ are deliberately absent.
//
// IT READS OVER ANY FRAME: every glyph white at 28px under one soft shadow on
// the column (ReelRail.jsx:17-41, the measured K13 look), so nothing here takes
// a role colour — on photography "quiet" and "invisible" are the same thing.
//
// THE SCORE DOOR HAS THREE FACES AND IS ALWAYS A DOOR (Reel.md:21-29;
// ReelRail.prompt.md:19): the figure the card wears, the dash where the latest
// fetch of the post found no paths, and — still settling — the bare glyph with
// `Still settling` under it. The rail never does arithmetic: it is handed the
// formatted figure (ReelRail.d.ts:25-31).

import Link from "next/link";
import type { ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon, type GlyphName } from "@/lib/ui/icons";
import { ExplainableNumber } from "@/lib/ui2/explainable-number";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";

/** The rail's one shadow (ReelRail.jsx:47 — `RAIL_SHADOW`). */
export const RAIL_SHADOW = "drop-shadow(0 1px 6px rgba(0,0,0,0.75))";

/** `Still settling` — the pending mark under the bare score glyph (Reel.md:25). */
export const STILL_SETTLING = "Still settling";

/** One rail control: a 28px glyph, its count beneath (ReelRail.jsx `ReelRailItem`). */
export function ReelRailItem({
  label,
  glyph,
  count,
  onClick,
  node,
  testId,
}: {
  /** The accessible name — the controls are glyphs, so this is all a listener gets. */
  label: string;
  glyph: GlyphName;
  count?: number;
  onClick?: () => void;
  node?: DataNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...testAttributes(node, testId)}
      className="cg-state cg-focus flex cursor-pointer flex-col items-center rounded-full border-0 bg-transparent font-sans text-label-small"
      style={{ gap: 2, width: 56, padding: "6px 0", color: "#fff" }}
    >
      <Icon name={glyph} size={28} />
      {count !== undefined && <span aria-hidden="true">{count}</span>}
    </button>
  );
}

/**
 * The score door in its three faces (ReelRail.jsx `ReelRailScore`). Settling,
 * the glyph stands bare with the pending mark under it, and the door stays:
 * "the score is the stream's only way into the post, and a settling clip has a
 * post like any other" (ReelRail.jsx:82-87). THE WHOLE FACE IS THE DOOR (round
 * 26, seam 250): `Still settling` stands inside it, the door's `settling`
 * part — `ExplainableNumber`'s pending face.
 */
export function ReelRailScore({
  value,
  settling,
  href,
  onOpen,
  node,
  testId,
}: {
  /** The formatted figure, or `—`; ignored while settling. */
  value?: string;
  settling: boolean;
  href: string;
  onOpen?: () => void;
  node?: DataNode;
  testId?: string;
}) {
  return (
    <ExplainableNumber
      glyph="graph"
      label="Feed score"
      value={settling ? undefined : value}
      pending={settling ? STILL_SETTLING : undefined}
      href={href}
      onOpen={onOpen}
      overMedia
      node={node}
      testId={testId}
    />
  );
}

export function ReelRail({
  author,
  stance,
  comments,
  onOpenComments,
  share,
  score,
  bottom,
  node,
  testId = "reel-rail",
}: {
  /** The post's author; their profile is the avatar's door (graph.json Reel via 3). */
  author: { handle: string; displayName: string; src?: string | null; href: string } | null;
  /** The opinion control in its media dress (`StanceControl overMedia`). */
  stance: ReactNode;
  /** Omitted, the comment item is not drawn (ReelRail.d.ts:33). */
  comments?: number;
  onOpenComments?: () => void;
  /** Omitted where the browser has neither share door (`share.ts`). */
  share?: { onShare: () => void };
  score: { value?: string; settling: boolean; href: string; onOpen?: () => void };
  /** Distance from the surface's bottom edge; clears the bar and the caption. */
  bottom: string;
  node?: DataNode;
  testId?: string;
}) {
  return (
    <div
      {...testAttributes(node, testId)}
      className="absolute flex flex-col items-center"
      style={{ right: 4, bottom, gap: 16, zIndex: 3, filter: RAIL_SHADOW }}
    >
      {author !== null && (
        <Link
          href={author.href}
          aria-label={author.displayName}
          {...testAttributes(part(node, "author"), `${testId}-author`)}
          className="cg-focus block no-underline"
        >
          <MonogramAvatar name={author.displayName} src={author.src} size={44} />
        </Link>
      )}
      {/* The face's row line has no row to stand under here, so it stands
          beside the face, on the stream's plate (`StanceControl overMedia`). */}
      <div className="relative">{stance}</div>
      {comments !== undefined && (
        <ReelRailItem
          label={comments === 1 ? "1 comment" : `${comments} comments`}
          glyph="chat_bubble"
          count={comments}
          onClick={onOpenComments}
          node={part(node, "comments")}
          testId={`${testId}-comments`}
        />
      )}
      {share !== undefined && (
        <ReelRailItem
          label="Share this post"
          glyph="share"
          onClick={share.onShare}
          node={part(node, "share")}
          testId={`${testId}-share`}
        />
      )}
      <ReelRailScore
        value={score.value}
        settling={score.settling}
        href={score.href}
        onOpen={score.onOpen}
        node={part(node, "score")}
        testId={`${testId}-score`}
      />
    </div>
  );
}
