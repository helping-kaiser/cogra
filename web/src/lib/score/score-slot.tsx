"use client";

// THE CARD'S SCORE SLOT (FeedKinds.md:3-15; PostDetail.md:17-19; History.md:29;
// Saved.md:13; TagPage.md:23; ProfilePosts.md:37): the Feed score every
// ranked card wears, between the opinion and the kind's own act, and the
// DOOR to its trace (ExplainableNumber).
//
// WHAT IT READS is the figure the latest fetch of its thing found — the
// reader's own last feed fetch, or its trace's fetch since (`standing.ts`).
// - a computed figure: the plain number (`15.20`, a negative's `−`);
// - none computed — a lookup miss, or a trace that found no paths: the dash,
//   still a door, since the tap is the one live fetch that can answer it;
// - a thing still settling: the compact slot stands BARE beside the card's
//   pending mark, and the detail reads the dash (FeedKinds.md:15;
//   ComposeLanded.md:5) — either way the door opens the trace that makes no
//   fetch (SR-G2(b): the settling slot is a door everywhere).
//
// THE TAP HANDS THE TRACE WHAT THE CARD HOLDS — the thing's cover and the view
// its figure was computed in (CD-SR1) — and the trace makes the one fetch.

import { DASH, cardFigure } from "./figure";
import { heldViewer } from "./standing";
import { beginTrace, traceHref, type TraceOrigin } from "./trace-session";
import { useScoreReader, useStanding } from "./use-standing";
import type { TraceCover } from "./cover";
import type { TraceThingKind } from "./trace-model";
import type { DataNode } from "@/lib/ui/data-node";
import { ExplainableNumber } from "@/lib/ui2/explainable-number";

export function ScoreSlot({
  targetId,
  kind,
  pending,
  cover,
  origin,
  dashWhileSettling = false,
  node,
  testId,
}: {
  targetId: string;
  kind: TraceThingKind;
  /** The thing's own landing state, as its row carries it. */
  pending: boolean;
  /** The thing as the card holds it, read at the tap. */
  cover: () => TraceCover;
  /** Where the slot stands: names the trace's first back arrow. */
  origin: TraceOrigin;
  /** The detail's settling score reads the dash, never a bare glyph (ComposeLanded.md:5). */
  dashWhileSettling?: boolean;
  /** The registered slot (`feed.card.actionRow.score`). */
  node?: DataNode;
  testId: string;
}) {
  const reader = useScoreReader();
  const standing = useStanding(targetId, pending);
  const settling = standing.kind === "settling";
  const value =
    standing.kind === "figure"
      ? cardFigure(standing.score)
      : standing.kind === "dash" || dashWhileSettling
        ? DASH
        : undefined;
  return (
    <ExplainableNumber
      glyph="graph"
      label="Feed score"
      value={value}
      href={traceHref({ targetId, kind, origin, settling })}
      onOpen={() => beginTrace(targetId, cover(), settling ? null : heldViewer(reader))}
      node={node}
      testId={testId}
    />
  );
}
