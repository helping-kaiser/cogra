"use client";

// The right edge of a reading-side reference row: the face, the exact pair, and
// — stacked under them — the settling mark.
//
// The tags-and-references sheet draws it, for both of its families — the
// tags this node's author signed and the citations. `ReferenceRow` carries
// its own edge with the same drawing (`PairValue`).
//
// THE DIGITS ARE THE GEEK READING (`ReferenceRow.jsx`): the face is drawn in
// both modes and the pair rides a `cg-exact` span that paints only when the
// screen root says `data-geek="on"`. Every hidden number has a
// screen-reader-only twin, because the mode is a drawing setting and nothing
// spoken may depend on it. The face stands at body-medium on a leading of 1,
// the master's own size beside the body-small digits.
//
// The settling mark rides the PAIR, not the name: what has not landed is the
// ACT, not the node it points at.

import { testAttributes, type DataNode } from "@/lib/ui/data-node";
import { PendingMarker } from "@/lib/ui/pending-marker";

export function PairReadout({
  emoji,
  exact,
  spoken,
  pending,
  testId,
  node,
}: {
  emoji: string;
  exact: string;
  spoken: string;
  pending: boolean;
  testId: string;
  /** The registered edge (`ReferenceRow`'s `value` part), where a screen names it. */
  node?: DataNode;
}) {
  return (
    <span
      className="flex flex-none flex-col items-end whitespace-nowrap text-body-small text-on-surface-variant"
      {...testAttributes(node)}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-1" data-testid={testId}>
        <span className="text-[length:var(--text-body-medium)]" style={{ lineHeight: 1 }}>
          {emoji}
        </span>
        <span className="cg-exact" data-testid={`${testId}-exact`}>
          {exact}
        </span>
      </span>
      <span className="sr-only">{spoken}</span>
      {pending && <PendingMarker inline testId={`${testId}-pending`} />}
    </span>
  );
}
