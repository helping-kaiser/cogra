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
// THE ROWS ARE `StagedReference`, the composer's own: the details stage draws
// a staged citation with the kind's mark, the sub-line, the pair, the × and
// the name that opens the pair — in a sheet of its own (ComposeCitations.md),
// never sliders unfolding in the row. Each control names its own citation.
//
// IT ADDS NOTHING. No "+ Cite something" here — `PickedSheet` manages a pick
// and never offers another one, and a door out of a seal that grew an add-row
// would hand the seal a stage's job. Every change applies the moment it is
// made; the last × closes the sheet back to the seal.

import { useState } from "react";

import type { ReferenceDraft } from "@/lib/references/draft";
import { BottomSheet, SHEET_RAISED } from "../bottom-sheet";
import { PillButton } from "../pill-button";
import { CITATION_FAMILY, PairSheet } from "./pair-sheet";
import { StagedReference } from "./staged-reference";

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
  // Which row has its pair open. Local: nothing about which editor is showing
  // is part of what gets signed.
  const [repairing, setRepairing] = useState<string | null>(null);
  const repaired = items.find((item) => item.targetId === repairing);

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={`Cited · ${items.length}`} testId={testId} maxHeight={SHEET_RAISED}>
        {/* The list carries its own 8px under the title (CitedSheet.jsx `8px 24px 0`). */}
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 pt-2">
          {items.map((item, index) => (
            <li key={item.targetId} data-testid={`${testId}-row-${index}`}>
              <StagedReference
                target={item.target}
                relevance={item.relevance}
                support={item.support}
                onEdit={() => setRepairing(item.targetId)}
                onRemove={() => {
                  onRemove(item.targetId);
                  // The last × closes the sheet to the seal it opened from.
                  if (items.length === 1) onClose();
                }}
                testId={`${testId}-${index}`}
              />
            </li>
          ))}
        </ul>
        <div className="-mx-2 flex justify-end pt-2">
          <PillButton testId={`${testId}-done`} variant="text" onClick={onClose}>
            Done
          </PillButton>
        </div>
      </BottomSheet>
      {repaired !== undefined && (
        <PairSheet
          open={repairing !== null}
          title={repaired.target.label}
          value={{ pDirected: repaired.relevance, pInterest: repaired.support }}
          family={CITATION_FAMILY}
          onDone={(pair) => {
            onRepair(repaired.targetId, { relevance: pair.pDirected, support: pair.pInterest });
            setRepairing(null);
          }}
          onDiscard={() => setRepairing(null)}
          testId={`${testId}-pair`}
        />
      )}
    </>
  );
}
