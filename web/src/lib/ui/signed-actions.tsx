"use client";

// What a submit is about to cost, in the one unit that is legible: signed
// actions (F4). Each act is priced separately (api-spec.md "A prepare may
// stage a batch"), so a form that stages a record plus four tag changes
// is five signings and five prices — the reader learns that BEFORE
// pressing, not from the signing prompts that follow.
//
// The indicator is always on screen and live; the dialog only stands in
// the way when more than one action is at stake, and can be switched off
// from inside itself.
//
// A native <dialog>, like the join prompt and the severance confirm:
// focus trapping, Esc, and the backdrop come from the platform. The
// confirming action sits on the RIGHT (F7).

import { useEffect, useRef, useState } from "react";

import { buttonClassName } from "@/lib/ui/button";

/** "creates 3 signed actions" — the same phrase in both places. */
export function signedActionsLine(count: number): string {
  if (count === 0) return "creates no signed actions";
  return count === 1 ? "creates 1 signed action" : `creates ${count} signed actions`;
}

export function SignedActionsIndicator({
  count,
  testId,
}: {
  count: number;
  testId: string;
}) {
  return (
    <p
      // Live, so a screen reader hears the count change as tags come and
      // go rather than only on submit.
      role="status"
      aria-live="polite"
      data-testid={testId}
      className="text-body-small text-on-surface-variant"
    >
      This {signedActionsLine(count)}.
    </p>
  );
}

export function MultiActionConfirm({
  count,
  busy = false,
  onConfirm,
  onCancel,
  testIdPrefix,
}: {
  count: number;
  busy?: boolean;
  /** `stopAsking` carries the checkbox, so the caller owns the write. */
  onConfirm: (stopAsking: boolean) => void;
  onCancel: () => void;
  testIdPrefix: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [stopAsking, setStopAsking] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      data-testid={`${testIdPrefix}-multi-action-confirm`}
      onClose={onCancel}
      className="m-auto w-[min(90vw,22rem)] rounded-extra-large bg-surface-container-high p-6 text-left text-on-surface backdrop:bg-scrim/50"
    >
      <h2 className="text-headline-small">Sign {count} actions?</h2>
      <p
        data-testid={`${testIdPrefix}-multi-action-count`}
        className="mt-2 text-body-medium text-on-surface-variant"
      >
        This submit {signedActionsLine(count)}, each paid for separately.
      </p>
      <label className="mt-4 flex items-center gap-3 text-body-medium">
        <input
          type="checkbox"
          checked={stopAsking}
          onChange={(event) => setStopAsking(event.target.checked)}
          data-testid={`${testIdPrefix}-multi-action-remember`}
          className="accent-primary"
        />
        Don&apos;t show this again
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          data-testid={`${testIdPrefix}-multi-action-cancel`}
          onClick={onCancel}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid={`${testIdPrefix}-multi-action-proceed`}
          disabled={busy}
          onClick={() => onConfirm(stopAsking)}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          Sign them
        </button>
      </div>
    </dialog>
  );
}
