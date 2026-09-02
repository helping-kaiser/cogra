"use client";

// DiscardConfirm — the one question asked before a written comment is lost.
//
// WHY IT EXISTS AT ALL, given comments have no drafts. Precisely because they
// have none: the post wizard's X is safe to press because the draft survives
// it, and a comment's X is not, so the two cannot share the same silent
// behaviour. The boards route EVERY leave edge in the reply flow through this
// dialog when something is written — ReplyCompose, ReplyPictures(Web),
// ReplyVideo, ReplyMediaErrors, ReplySeal and CommentEdit all carry the same
// pair: "something written — the confirm", "empty — leaves at once".
//
// IT ASKS ONLY WHEN THERE IS SOMETHING TO LOSE. An empty composer leaves at
// once, because a confirmation over nothing trains an author to dismiss the
// dialog without reading it — which is exactly what makes it useless on the day
// it matters.
//
// The copy is the board's, and its two lines do different work: the question
// names what is being discarded, and "Nothing is kept" answers the question an
// author actually has — whether this comes back. It does not.

import { useEffect, useRef } from "react";

import { PillButton } from "../pill-button";

export function DiscardConfirm({
  open,
  onKeepWriting,
  onDiscard,
  testId = "discard-confirm",
}: {
  open: boolean;
  onKeepWriting: () => void;
  onDiscard: () => void;
  testId?: string;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);

  // A NATIVE `dialog`, opened with `showModal`, so the platform supplies the
  // focus trap, the backdrop and the Escape key rather than this component
  // re-implementing three things browsers already do correctly.
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
      // Escape closes without discarding: the destructive answer is never the
      // one a stray keypress reaches.
      onCancel={(event) => {
        event.preventDefault();
        onKeepWriting();
      }}
      className="m-auto w-[calc(100%-3.375rem)] max-w-[22rem] rounded-extra-large border-0 bg-surface-container-high p-6 text-on-surface backdrop:bg-scrim/50"
    >
      <h2 id={`${testId}-title`} className="m-0 text-title-medium">
        Discard this reply?
      </h2>
      <p className="mt-2 mb-6 text-body-medium text-on-surface-variant">Nothing is kept.</p>
      <div className="flex justify-end gap-2">
        {/* Keep writing leads the pair and carries the emphasis: the safe
            answer is the easy one to hit, and the destructive one is never a
            default. */}
        <PillButton testId={`${testId}-discard`} variant="text" onClick={onDiscard}>
          Discard
        </PillButton>
        <PillButton testId={`${testId}-keep`} onClick={onKeepWriting}>
          Keep writing
        </PillButton>
      </div>
    </dialog>
  );
}
