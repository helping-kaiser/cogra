// "Describe this picture" (design/components/compose/DescribeSheet) — where alt
// text is written.
//
// Reached PER PICTURE from the details step's describe counter and from the Show
// all sheet, and NEVER from the crop step: a geometry step is no place for a
// keyboard. The rule it makes enterable is the component rule — a description is
// authored, optional, and never invented; a picture without one is skipped by
// screen readers rather than guessed at.

import { useState } from "react";

import { BottomSheet } from "../bottom-sheet";
import { HelpDialog, HELP_TOPICS } from "../help-dialog";
import { PillButton } from "../pill-button";
import { TextField } from "../text-field";

export function DescribeSheet({
  open,
  onClose,
  src,
  value,
  onChange,
  position,
  testId = "describe-sheet",
}: {
  open: boolean;
  onClose: () => void;
  src?: string | null;
  value: string;
  onChange: (next: string) => void;
  // "2 of 3" — which picture is being described, when the set has more than one.
  position?: { index: number; total: number };
  testId?: string;
}) {
  const [help, setHelp] = useState(false);
  return (
    <BottomSheet open={open} onClose={onClose} title="Describe this picture" testId={testId}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {position && position.total > 1 ? (
            <p className="m-0 flex-1 text-label-small text-on-surface-variant">
              Picture {position.index + 1} of {position.total}
            </p>
          ) : (
            <span className="flex-1" />
          )}
          {/* The sheet's own `?` — it carries the full explanation, so the
              field beneath it can stay one short line. */}
          <button
            type="button"
            data-testid={`${testId}-help`}
            aria-label="Describing pictures"
            onClick={() => setHelp(true)}
            className="cg-state cg-focus flex size-8 flex-none items-center justify-center rounded-full border border-outline-variant text-label-large text-primary"
          >
            ?
          </button>
        </div>
        <div className="flex h-[180px] items-center justify-center overflow-hidden rounded-medium bg-surface-container-high">
          {src ? (
            // A blob: URL for bytes that have not left the device.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" aria-hidden="true" className="block max-h-full max-w-full" />
          ) : null}
        </div>
        <TextField
          label="What's in the picture"
          optional
          multiline
          rows={2}
          value={value}
          onChange={onChange}
          testId={`${testId}-field`}
        />
        <p className="m-0 text-label-small text-on-surface-variant">
          Read aloud to people who can&apos;t see it, and shown if the picture can&apos;t load.
        </p>
        <div className="flex justify-end">
          <PillButton testId={`${testId}-done`} variant="text" onClick={onClose}>
            Done
          </PillButton>
        </div>
      </div>

      <HelpDialog
        open={help}
        onClose={() => setHelp(false)}
        topic={HELP_TOPICS.describingPictures}
        testId={`${testId}-help-dialog`}
      />
    </BottomSheet>
  );
}
