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

import { BottomSheet } from "../bottom-sheet";
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
      testId={`${testIdPrefix}-sensitive-sheet`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex-1" />
          <button
            type="button"
            data-testid={`${testIdPrefix}-sensitive-help`}
            aria-label="Marking as sensitive"
            onClick={onHelp}
            className="cg-state cg-focus flex size-8 flex-none items-center justify-center rounded-full border border-outline-variant text-label-large text-primary"
          >
            ?
          </button>
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
        </div>
        <p className="m-0 text-body-medium">
          Veils the pictures and the description until a reader chooses to look.
        </p>
        <TextField
          label="Why?"
          value={reason}
          onChange={onReason}
          testId={`${testIdPrefix}-sensitive-reason`}
          // The corner says where it lands, which is what makes it worth
          // writing — a reason nobody sees is a form field for its own sake.
          optionalLabel="Optional — shown on the veil"
          optional
          disabled={!marked}
        />
        <div className="flex justify-end">
          <PillButton testId={`${testIdPrefix}-sensitive-done`} onClick={onClose}>
            Done
          </PillButton>
        </div>
      </div>
    </BottomSheet>
  );
}
