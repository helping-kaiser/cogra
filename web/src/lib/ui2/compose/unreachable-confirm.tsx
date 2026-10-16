"use client";

// `Start it unreachable?` — the one question the compose pad asks, at a Set
// of exactly 0.00 (ComposePad.md; copy-voice, *The unreachable start*).
//
// AT 0.00 A PUBLISH CARRIES NOTHING: it folds to `(0, 1)` and either parameter
// at zero makes `w̃ = 0`, a dead hop rather than a low rating (verified against
// the L1 original and CoGra's path math, seam 232). The post's own path into
// anyone's feed is gone — though the first legs of its author's own tags and
// citations still reach it. That is a legal start, so the dialog WARNS AND
// NEVER STOPS: the pick is never refused.
//
// IT STANDS OVER THE PAD, which stays parked beneath it: `Keep adjusting`
// closes the question onto the pad at the same pick, `Set it anyway` sets 0.00
// and closes both. Keep adjusting is filled and leads — the easy answer is the
// one that changes nothing. An edit never asks: its pick is the edge, and 0.00
// there changes the backing by nothing (EditPad.md).

import { useEffect, useRef } from "react";

import { PillButton } from "../pill-button";

export const UNREACHABLE_TITLE = "Start it unreachable?";
export const UNREACHABLE_BODY =
  "Your backing is your post's own path into anyone's feed. At 0.00 that path carries nothing — your post will live on your profile, reached only through the tags and citations you sign with it, until someone gives it an opinion.";

export function UnreachableConfirm({
  open,
  onKeepAdjusting,
  onSetAnyway,
  testId,
}: {
  open: boolean;
  onKeepAdjusting: () => void;
  onSetAnyway: () => void;
  testId: string;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);

  // A NATIVE `dialog` over the pad's own: the top layer stacks them, so the
  // pad stays parked and inert beneath while the question is up.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      data-testid={testId}
      aria-labelledby={`${testId}-title`}
      // Escape is the safe answer: back to the pad, nothing set.
      onCancel={(event) => {
        event.preventDefault();
        onKeepAdjusting();
      }}
      onClose={() => {
        if (open) onKeepAdjusting();
      }}
      className="cg-dialog-in m-auto w-[calc(100%-3.375rem)] max-w-[22rem] rounded-extra-large border-0 bg-surface-container-high p-6 text-on-surface backdrop:bg-scrim/50"
    >
      <h2 id={`${testId}-title`} className="m-0 text-headline-small">
        {UNREACHABLE_TITLE}
      </h2>
      <p className="mt-2 mb-6 text-body-medium text-on-surface-variant">{UNREACHABLE_BODY}</p>
      <div className="flex justify-end gap-2">
        <PillButton testId={`${testId}-anyway`} variant="text" onClick={onSetAnyway}>
          Set it anyway
        </PillButton>
        <PillButton testId={`${testId}-keep`} onClick={onKeepAdjusting}>
          Keep adjusting
        </PillButton>
      </div>
    </dialog>
  );
}
