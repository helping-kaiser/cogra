"use client";

// EditPad — the pad over a post edit, what the edit's `Your backing` row's
// `Adjust` opens (design/designs/canonical/screens/EditPad.jsx; EditPad.md;
// jakob 2026-10-16, PR-101, round 15).
//
// IT IS THE COMPOSE PAD'S ONE AXIS. An edit is an ordinary-role Publish toward
// the post — the family that minted it — so its record carries the same one
// free parameter, the author's backing, with the second pinned at 1 by the
// census. What the author thinks of the post is the ordinary opinion its face
// takes, a bundle of its own.
//
// THE PICK IS THE EDGE ("you add an edge with what you set and you get the
// readout of what you are setting and what this will result in"). The strip
// collects the edit's own record — 0.00 by default, which changes the backing
// by nothing and is a perfectly ordinary edit. `Current backing` (the bundle's
// net now) and `Your pick` stand above the strip, `Backing after` below it.
// Every pick on the strip is legal, and no dialog guards a Set at 0.00.
//
// ONLY THE WALK-BACK AIMS AT A RESULT. `Walk it all back` stands on the left
// of the commit row, pushed away from Cancel and Set: it parks the pick at the
// raw sum's opposite, clipped to the strip, and is greyed while the backing
// already nets 0.00. It parks a pick; Set still signs nothing — Set STAGES,
// and `Sign the edit` signs it with the rest of the batch.
//
// The pad works on its own staged pick, opened at the edit's: Cancel, the
// wash and Escape put nothing back because nothing was written through.

import { useState } from "react";

import { walkBackPick, WALK_IT_ALL_BACK } from "@/lib/stance/backing";
import { AttachmentLandingLine, AttachmentStanding } from "@/lib/ui/attachment-readout";
import { HelpDot } from "../help-dot";
import { PillButton } from "../pill-button";
import { AttachmentPad } from "./attachment-pad";
import { ParkedPad } from "./parked-pad";

export function BackingEditPad({
  open,
  pick,
  rawSum,
  onSet,
  onClose,
  onHelp,
  testId,
}: {
  open: boolean;
  /** The edit's pick as it stands — where the pad opens. */
  pick: number;
  /**
   * The raw sum of the author's Publish records toward the post — null when
   * the read answered none or failed (`fetchPostBacking`).
   */
  rawSum: number | null;
  /** Set: the staged pick becomes the edit's. */
  onSet: (pick: number) => void;
  /** Cancel, the wash, Escape: nothing is staged. */
  onClose: () => void;
  onHelp: () => void;
  testId: string;
}) {
  // Mounted per opening by its host, so the staged pick starts at the edit's.
  const [staged, setStaged] = useState(pick);
  const walkBack = rawSum === null ? null : walkBackPick(rawSum);

  return (
    <ParkedPad
      open={open}
      onClose={onClose}
      ariaLabel="Backing pad for your own post"
      standoff="compose"
      testId={testId}
    >
      <span className="absolute top-1 right-1">
        <HelpDot ariaLabel="Your backing on your post" onOpen={onHelp} testId={`${testId}-help`} />
      </span>
      <div className="pr-10">
        <AttachmentStanding pick={staged} rawSum={rawSum} testIdPrefix={testId} />
      </div>
      <div role="group" aria-label="Backing pad for your own post" className="self-stretch">
        <AttachmentPad value={staged} onChange={setStaged} testId={`${testId}-field`} />
      </div>
      <AttachmentLandingLine rawSum={rawSum} pick={staged} testIdPrefix={testId} />
      <div className="flex items-center justify-end gap-2">
        {/* Greyed, and doing nothing, while the backing nets 0.00 — or while
            the raw sum it parks against is unread. */}
        <span className="mr-auto">
          <PillButton
            variant="text"
            size="sm"
            testId={`${testId}-walk-back`}
            disabled={walkBack === null}
            onClick={() => {
              if (walkBack !== null) setStaged(walkBack);
            }}
          >
            {WALK_IT_ALL_BACK}
          </PillButton>
        </span>
        <PillButton variant="text" size="sm" testId={`${testId}-cancel`} onClick={onClose}>
          Cancel
        </PillButton>
        <PillButton size="sm" testId={`${testId}-set`} onClick={() => onSet(staged)}>
          Set
        </PillButton>
      </div>
    </ParkedPad>
  );
}
