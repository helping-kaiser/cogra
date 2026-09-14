"use client";

// REMOVE — THE THINK-TWICE DIALOG
// (design/designs/canonical/screens/RemoveConfirm.jsx).
//
// THE SAFE ACTION IS THE FILLED ONE. `Keep it` carries the fill and sits last,
// where the thumb lands; Remove is a text button in `--error`. The weight of a
// removal belongs on the confirmation rather than on the menu row that opened
// it, which is why the row itself is drawn like every other.
//
// THE WORDS ARE THE DESIGN HERE, verbatim from the board: what leaves, what
// stays in its place, and that it cannot be taken back.

// Built on the native `<dialog>`, as `HelpDialog` is: it gives the top layer,
// the backdrop, modal focus containment and Escape without any of them being
// reimplemented.

import { useEffect, useRef } from "react";

import { PillButton } from "./pill-button";

export function RemoveConfirm({
  open,
  onClose,
  onRemove,
  testId = "post-remove-confirm",
}: {
  open: boolean;
  onClose: () => void;
  onRemove: () => void;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-label="Remove this post?"
      onClose={onClose}
      // A press outside KEEPS the post. Dismissing a think-twice dialog is the
      // safe answer, which is the same answer its filled button gives.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="cg-dialog-in m-auto w-[calc(100%-3.375rem)] max-w-[22rem] rounded-extra-large border-0 bg-surface-container-high p-6 text-on-surface backdrop:bg-scrim/50"
    >
      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-headline-small">Remove this post?</h2>
        <p className="m-0 text-body-medium">
          The words and pictures leave every reader&rsquo;s view, along with every earlier
          version&rsquo;s. A visible mark stays in their place — &ldquo;Removed by its
          author&rdquo; — and the post&rsquo;s spot in threads stays with it.
        </p>
        <p className="m-0 text-body-medium">This is immediate and permanent.</p>
        <div className="flex justify-end gap-2">
          {/* The one place `--error` is spoken here, and it is on a text
              button: a removal is a deliberate act, not a failure. */}
          <PillButton testId={`${testId}-remove`} variant="text" onClick={onRemove}>
            <span className="text-error">Remove</span>
          </PillButton>
          <PillButton testId={`${testId}-keep`} onClick={onClose}>
            Keep it
          </PillButton>
        </div>
      </div>
    </dialog>
  );
}
