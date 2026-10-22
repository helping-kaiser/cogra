"use client";

// THE AUTHOR'S OWN SENSITIVE MARK — the ComposeSensitive sheet.
//
// ONE SHEET FOR EVERY SURFACE THAT MARKS. The canvas draws a single
// ComposeSensitive and every "Mark" edge on the graph points at it — the post's
// seal and the comment edit alike — so a second copy would be the place the two
// silently drift apart.
//
// The switch is the declaration and the reason is optional beside it; the reason
// is only ever sent WITH the mark, because a reason on an unmarked post is a
// field-level refusal, which is why the field greys out when the switch is off.

import { useState } from "react";

import { SENSITIVE_REASON_MAX_CHARS, sensitiveReasonProblem } from "@/lib/compose/wizard";
import { BottomSheet } from "../bottom-sheet";
import { HelpDot } from "../help-dot";
import { PillButton } from "../pill-button";
import { TextField } from "../text-field";

// IT COMMITS ON DONE (the sheet law, readme §4, *Sheets*; ComposeSensitive.md).
// The switch and the reason STAGE; Done carries them to the host; the scrim, a
// swipe down, system Back and Escape discard, and the mark and its reason are
// what they were. `Mark` opens it with the switch ON (jakob 2026-10-01): the
// tap was the intent, so an unmarked post's sheet opens marked.
export function SensitiveSheet({
  open,
  reason,
  onDone,
  onClose,
  onHelp,
  testIdPrefix,
}: {
  open: boolean;
  /** The reason as it stands; the mark always opens on (`Mark` was the intent). */
  reason: string;
  /** Done: the mark and its reason as staged in the sheet. */
  onDone: (next: { sensitive: boolean; sensitiveReason: string }) => void;
  /** Every other way out — nothing staged in the sheet applies. */
  onClose: () => void;
  onHelp: () => void;
  testIdPrefix: string;
}) {
  const [staged, setStaged] = useState({ sensitive: true, sensitiveReason: reason });
  // Each opening starts from the mark as it stands — switched on when it
  // stands off — adjusted during render rather than in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStaged({ sensitive: true, sensitiveReason: reason });
  }
  const over = staged.sensitive && sensitiveReasonProblem(staged.sensitiveReason) !== null;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Mark as sensitive"
      titleTrailing={
        <>
          <HelpDot ariaLabel="Sensitive" onOpen={onHelp} testId={`${testIdPrefix}-sensitive-help`} />
          {/* `Switch` (SettingsRow.jsx) at the sheet's own geometry: off is
              the field's outline and an outline knob at the left, on is
              `primary` with an `on-primary` knob at the right. */}
          <button
            type="button"
            role="switch"
            aria-checked={staged.sensitive}
            aria-label="Mark as sensitive"
            data-testid={`${testIdPrefix}-sensitive-switch`}
            onClick={() => setStaged((current) => ({ ...current, sensitive: !current.sensitive }))}
            className={`cg-state cg-focus cg-hit relative box-border h-6 w-11 flex-none cursor-pointer rounded-full p-0 ${
              staged.sensitive ? "border-0 bg-primary" : "border border-solid border-outline bg-transparent"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full ${
                staged.sensitive ? "right-[3px] bg-on-primary" : "left-[2px] bg-outline"
              }`}
            />
          </button>
        </>
      }
      testId={`${testIdPrefix}-sensitive-sheet`}
    >
      {/* `min-h-0` is what lets the reason yield: the sheet stops at its
          ceiling, and the growing box is the one child here that can give
          the room back. */}
      <div className="flex min-h-0 flex-col gap-3">
        <p className="m-0 flex-none text-body-medium">
          Veils the pictures and the words until a reader chooses to look.
        </p>
        {/* ONE LINE TO START, AND IT GROWS (jakob 2026-09-22). */}
        <TextField
          label="Why?"
          value={staged.sensitiveReason}
          onChange={(sensitiveReason) => setStaged((current) => ({ ...current, sensitiveReason }))}
          multiline
          rows={1}
          testId={`${testIdPrefix}-sensitive-reason`}
          // The corner says where it lands, which is what makes it worth
          // writing — a reason nobody sees is a form field for its own sake.
          optionalLabel="Optional — shown on the veil"
          optional
          disabled={!staged.sensitive}
          cap={SENSITIVE_REASON_MAX_CHARS}
          // The reason only counts against the cap while the mark is on — an
          // over-length leftover from a mark switched back off is never sent
          // (`sensitiveInput`), so it earns no error on a greyed-out field.
          error={staged.sensitive ? sensitiveReasonProblem(staged.sensitiveReason) ?? undefined : undefined}
        />
        <div className="flex flex-none justify-end">
          {/* Visible but disabled over the cap, never hidden. */}
          <PillButton testId={`${testIdPrefix}-sensitive-done`} disabled={over} onClick={() => onDone(staged)}>
            Done
          </PillButton>
        </div>
      </div>
    </BottomSheet>
  );
}
