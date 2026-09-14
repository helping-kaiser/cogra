"use client";

// CitedSheet — the staged citations, managed
// (`design/components/compose/CitedSheet.jsx`, jakob's ruling 2026-09-14,
// design backlog item 70). The sheet a seal's References row opens once the
// row COUNTS instead of naming: one staged citation reads back as itself on
// the seal, two or more read back as "N cited", and this is where the N is.
//
// IT IS `PickedSheet`'S SHAPE, for the reason that sheet has its shape: a
// collection staged by an author is managed in ONE place rather than in as
// many places as it appears. Rows, then the word that closes the sheet.
//
// IT ADDS NOTHING. No "+ Cite something" here — `PickedSheet` manages a pick
// and never offers another one, and a door out of a seal that grew an add-row
// would hand the seal a stage's job. Citations are staged where they are
// staged: the wizard's details step, the reply's own card.
//
// EACH CONTROL NAMES ITS OWN CITATION — "Remove <name>", "<name> — set how it
// relates" — or a block of three is a block of identically-named buttons
// (`StagedReference.jsx:31-34`).
//
// WHAT THE ROW DOES NOT DRAW YET: the master's row opens with `NodeMark`, the
// kind's mark. Neither platform carries a NodeMark — it belongs to the
// READING side's `ReferenceRow` family, which this lane is held out of — so
// the row starts at the name and the mark is parked, not invented.

import { useState } from "react";

import type { ReferenceDraft, ReferenceTargetView } from "@/lib/references/draft";
import { nearestAnchor } from "@/lib/stance/anchors";
import { formatStancePair, formatStanceWords } from "@/lib/ui/stance-format";
import { ReferenceParamSliders } from "@/lib/ui/reference-param-sliders";
import { BottomSheet } from "../bottom-sheet";
import { PillButton } from "../pill-button";

const CLOSE_GLYPH =
  "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z";

/**
 * The sub-line: what class of thing is cited, as the master writes it — a
 * post reads "Post" and a person reads "Person", because a cite stages a post
 * and a mention stages a person and the block cannot tell them apart
 * (`_shared.jsx:894-896`). A comment is the class the master does not draw;
 * it takes its own name rather than being folded into one of the two. A
 * target this instance carries no display row for has no class to name.
 */
function subLine(target: ReferenceTargetView): string | null {
  switch (target.kind) {
    case "Post":
      return "Post";
    case "Comment":
      return "Comment";
    case "User":
      return "Person";
    default:
      return null;
  }
}

export function CitedSheet({
  open,
  onClose,
  items,
  onRemove,
  onRepair,
  testId = "cited-sheet",
}: {
  open: boolean;
  onClose: () => void;
  items: readonly ReferenceDraft[];
  /** Drops the citation from the staged set the details stage owns. */
  onRemove: (targetId: string) => void;
  /** Moves one citation's signed pair — the same staged set, re-paired. */
  onRepair: (targetId: string, next: { relevance: number; support: number }) => void;
  testId?: string;
}) {
  // Which row has its pair open. Local, exactly as the details stage's own
  // section holds it: nothing about which editor is showing is part of what
  // gets signed.
  const [repairing, setRepairing] = useState<string | null>(null);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Cited · ${items.length}`}
      testId={testId}
    >
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {items.map((item, index) => (
          <li
            key={item.targetId}
            data-testid={`${testId}-row-${index}`}
            className="flex flex-col gap-1 rounded-small bg-surface-container-highest px-3 py-2"
          >
            <div className="flex min-h-12 items-center gap-2">
              <button
                type="button"
                aria-label={`${item.target.label} — set how it relates`}
                aria-expanded={repairing === item.targetId}
                data-testid={`${testId}-repair-${index}`}
                onClick={() =>
                  setRepairing(repairing === item.targetId ? null : item.targetId)
                }
                className="cg-state cg-focus flex min-w-0 flex-1 cursor-pointer flex-col items-start border-0 bg-transparent p-0 text-left"
              >
                <span className="w-full truncate text-body-medium">{item.target.label}</span>
                {subLine(item.target) !== null && (
                  <span className="text-body-small text-on-surface-variant">
                    {subLine(item.target)}
                  </span>
                )}
              </button>
              <StanceReadout relevance={item.relevance} support={item.support} />
              <button
                type="button"
                aria-label={`Remove ${item.target.label}`}
                data-testid={`${testId}-remove-${index}`}
                onClick={() => {
                  if (repairing === item.targetId) setRepairing(null);
                  onRemove(item.targetId);
                }}
                className="cg-state cg-focus flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full text-on-surface-variant"
              >
                <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
                  <path d={CLOSE_GLYPH} />
                </svg>
              </button>
            </div>
            {repairing === item.targetId && (
              <ReferenceParamSliders
                relevance={item.relevance}
                support={item.support}
                onChange={(next) => onRepair(item.targetId, next)}
                forLabel={item.target.label}
                testIdPrefix={`${testId}-${index}`}
              />
            )}
          </li>
        ))}
      </ul>
      <div className="flex justify-end pt-2">
        <PillButton testId={`${testId}-done`} variant="text" onClick={onClose}>
          Done
        </PillButton>
      </div>
    </BottomSheet>
  );
}

/**
 * The pair the citation signs, as every staged citation wears it: the face
 * carries the feel, the digits carry the fact, and a screen-reader-only twin
 * says both so nothing spoken moves with the geek setting.
 */
function StanceReadout({ relevance, support }: { relevance: number; support: number }) {
  const pair = { pDirected: relevance, pInterest: support };
  const anchor = nearestAnchor(pair);
  return (
    <span className="inline-flex flex-none items-baseline gap-1">
      <span aria-hidden="true" className="text-body-medium">
        {anchor.emoji}
      </span>
      <span aria-hidden="true" className="text-body-small text-on-surface-variant">
        {formatStancePair(pair)}
      </span>
      <span className="sr-only">
        {anchor.label}, {formatStanceWords(pair)}
      </span>
    </span>
  );
}
