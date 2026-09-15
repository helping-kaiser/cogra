"use client";

// The right edge of a reading-side reference row: the face, the exact pair, and
// — stacked under them — the settling mark.
//
// It lives on its own because it is drawn on more than one sheet: the
// tags-and-references sheet reads the acts this node's author signed, and the
// cited-by sheet reads the acts other people signed at it. One drawing, one
// module — the rule `ListRow` already states for the row around it.
//
// The face is the quick read and the numbers carry the fact; every hidden
// number has a screen-reader-only twin, because the visual pairing of glyph and
// digits says nothing on its own.
//
// The settling mark rides the PAIR, not the name: what has not landed is the
// ACT, not the node it points at.

import { PendingMarker } from "@/lib/ui/pending-marker";

export function PairReadout({
  emoji,
  exact,
  spoken,
  pending,
  testId,
}: {
  emoji: string;
  exact: string;
  spoken: string;
  pending: boolean;
  testId: string;
}) {
  return (
    <span className="flex flex-none flex-col items-end whitespace-nowrap text-body-small text-on-surface-variant">
      <span aria-hidden="true" className="inline-flex items-center gap-1" data-testid={testId}>
        <span>{emoji}</span>
        <span>{exact}</span>
      </span>
      <span className="sr-only">{spoken}</span>
      {pending && <PendingMarker inline testId={`${testId}-pending`} />}
    </span>
  );
}
