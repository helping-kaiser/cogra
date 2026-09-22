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

import { SENSITIVE_REASON_MAX_CHARS, sensitiveReasonProblem } from "@/lib/compose/wizard";
import { BottomSheet } from "../bottom-sheet";
import { HelpDot } from "../help-dot";
import { PillButton } from "../pill-button";
import { TextField } from "../text-field";

export function SensitiveSheet({
  open,
  marked,
  reason,
  onMarked,
  onReason,
  onClose,
  onHelp,
  testIdPrefix,
}: {
  open: boolean;
  marked: boolean;
  reason: string;
  onMarked: (next: boolean) => void;
  onReason: (next: string) => void;
  onClose: () => void;
  onHelp: () => void;
  testIdPrefix: string;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Mark as sensitive"
      titleTrailing={
        <>
          <HelpDot
            ariaLabel="Marking as sensitive"
            onOpen={onHelp}
            testId={`${testIdPrefix}-sensitive-help`}
          />
          <button
            type="button"
            role="switch"
            aria-checked={marked}
            aria-label="Mark as sensitive"
            data-testid={`${testIdPrefix}-sensitive-switch`}
            onClick={() => onMarked(!marked)}
            className={`cg-focus relative h-6 w-11 flex-none rounded-full ${
              marked ? "bg-primary" : "bg-surface-container-highest"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-[3px] size-[18px] rounded-full ${
                marked ? "right-[3px] bg-on-primary" : "left-[3px] bg-outline"
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
        {/* ONE LINE TO START, AND IT GROWS (jakob 2026-09-22). A reason is a
            sentence, not a word, and the single-line input it was hid
            everything past the first phrase of it. */}
        <TextField
          label="Why?"
          value={reason}
          onChange={onReason}
          multiline
          rows={1}
          testId={`${testIdPrefix}-sensitive-reason`}
          // The corner says where it lands, which is what makes it worth
          // writing — a reason nobody sees is a form field for its own sake.
          optionalLabel="Optional — shown on the veil"
          optional
          disabled={!marked}
          cap={SENSITIVE_REASON_MAX_CHARS}
          // The reason only counts against the cap while the mark is on —
          // an over-length leftover from a mark switched back off is never
          // sent (`sensitiveInput`), so it earns no error on a field the
          // switch has already greyed out.
          error={marked ? sensitiveReasonProblem(reason) ?? undefined : undefined}
        />
        <div className="flex flex-none justify-end">
          {/* Visible but disabled over the cap, never hidden — the same
              gate the field's own error line above uses. */}
          <PillButton
            testId={`${testIdPrefix}-sensitive-done`}
            disabled={marked && sensitiveReasonProblem(reason) !== null}
            onClick={onClose}
          >
            Done
          </PillButton>
        </div>
      </div>
    </BottomSheet>
  );
}
