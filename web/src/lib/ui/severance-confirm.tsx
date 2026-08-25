"use client";

// The severance confirmation (design.md §8.5). It serves both routes to
// `(0, 0)`: the explicit "sever" gesture, and an ordinary pick that
// happens to land the bundle there — the second is confirmed, never
// refused, because the control never prevents a choice (§8.2). What
// separates them is what gets signed, so the dialog says which.
//
// The batch size is the legible cost (api-spec.md "A prepare may stage a
// batch"): each counter-record is its own priced act, so the count is
// what the reader needs before signing, and it is stated in both modes.
//
// A native <dialog>, like the join prompt: focus trapping, Esc, and the
// backdrop come from the platform rather than from hand-rolled handlers.

import { useEffect, useRef } from "react";

import { buttonClassName } from "@/lib/ui/button";

export type SeveranceKind = "sever" | "landsAtZero";

export function SeveranceConfirm({
  kind,
  targetLabel,
  records,
  busy = false,
  onConfirm,
  onCancel,
}: {
  kind: SeveranceKind;
  /** Already in the reader's words — "this post", "@ada". */
  targetLabel: string;
  /** How many signed steps reaching zero takes. */
  records: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  const steps = records === 1 ? "1 signed step" : `${records} signed steps`;

  return (
    <dialog
      ref={ref}
      data-testid="severance-confirm"
      onClose={onCancel}
      className="m-auto w-[min(90vw,22rem)] rounded-extra-large bg-surface-container-high p-6 text-left text-on-surface backdrop:bg-scrim/50"
    >
      <h2 className="text-headline-small">
        {kind === "sever" ? `Cut off ${targetLabel}?` : "This ends your standing"}
      </h2>
      {/* Not `error` colouring: severance is a deliberate choice, not a
          failure (design.md §2.4). */}
      <p data-testid="severance-consequences" className="mt-2 text-body-medium text-on-surface-variant">
        {kind === "sever"
          ? `Your standing toward ${targetLabel} drops to nothing. It stops reaching your feed, you stop earning from it, and nothing passes on through you.`
          : `That pick lands your standing toward ${targetLabel} at nothing — it stops reaching your feed, you stop earning from it, and nothing passes on through you.`}
      </p>
      <p data-testid="severance-cost" className="mt-2 text-body-medium">
        {kind === "sever"
          ? `Getting there takes ${steps}, one for each stance being walked back. You sign them in one go, and each is priced on its own.`
          : `It takes ${steps} to sign.`}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          data-testid="severance-cancel"
          onClick={onCancel}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          Keep it
        </button>
        <button
          type="button"
          data-testid="severance-proceed"
          disabled={busy}
          onClick={onConfirm}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          {kind === "sever" ? "Cut it off" : "Yes, that was the intent"}
        </button>
      </div>
    </dialog>
  );
}
