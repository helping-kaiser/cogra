// ONE ROW OF A TAG'S PAGE (`TaggedRow.jsx`; readme §13, the tag round): the
// claim that put this content here, and then the content itself.
//
// THE PAIR BELONGS TO THE ROW, NOT THE CARD. `taggedContent` hands back
// `{ node, relevance, confidence, pending }` — the pair is a fact about the
// TAG RECORD pointing at the node — so the card is drawn by its own component,
// untouched, and the claim sits above it as a flag the card attaches under
// (`attach`): flag and card fuse into one folder-tab silhouette.
//
// THE ROW WEARS THE TAG TABLE'S GLYPH. The claim's reading (`tagReadout`)
// leads the flag; the exact pair rides a `cg-exact` span and paints only in
// geek mode. Both come from one pair, so they never disagree. The spoken
// reading is one visually hidden span, the same in both modes — an emoji's own
// accessible name is not the claim's.
//
// A CLAIM STILL IN FLIGHT SAYS SO with the marker every unsettled record wears.
//
// ITS REGISTERED NAME (round 60, seam 380 / 381) names the flag alone, never
// the row around it, so the card under it keeps its own path: the flag
// `node`, its `glyph`, the exact pair `exact` and the marker `pending`, keyed
// by the tagged thing's id.

import type { ReactNode } from "react";

import { tagReadout } from "@/lib/topics/anchors";
import { part, testAttributes, type DataNode } from "./data-node";
import { PendingMarker } from "./pending-marker";
import { formatTagPair } from "./tag-format";

export function TaggedRow({
  relevance,
  confidence,
  pending = false,
  node,
  testId,
  children,
}: {
  /** What the tag claimed: relevance signed over [-1, +1]. */
  relevance: number;
  /** Confidence, unsigned over [0, 1]. */
  confidence: number;
  /** The claim is staged and not yet ordered. */
  pending?: boolean;
  /** The registered claim (`tagPage.claim`, keyed by the tagged thing's id). */
  node?: DataNode;
  testId: string;
  /** The content's own card, attached under the flag. */
  children: ReactNode;
}) {
  const anchor = tagReadout(relevance, confidence);
  const exact = formatTagPair(relevance, confidence);
  return (
    <div className="flex flex-col">
      <div
        {...testAttributes(node, testId)}
        className="inline-flex items-center gap-2 self-start rounded-t-small bg-surface-container-high px-2.5 py-0.5 text-body-small text-on-surface-variant"
      >
        <span
          aria-hidden="true"
          {...testAttributes(part(node, "glyph"), `${testId}-glyph`)}
          className="text-body-medium [line-height:1]"
        >
          {anchor.emoji}
        </span>
        <span aria-hidden="true">Tagged</span>
        <span
          aria-hidden="true"
          {...testAttributes(part(node, "exact"), `${testId}-exact`)}
          className="cg-exact whitespace-nowrap"
        >
          {exact}
        </span>
        <span className="sr-only">{`Tagged: ${anchor.label}, ${exact}`}</span>
        {pending && <PendingMarker testId={`${testId}-pending`} node={part(node, "pending")} />}
      </div>
      {children}
    </div>
  );
}
