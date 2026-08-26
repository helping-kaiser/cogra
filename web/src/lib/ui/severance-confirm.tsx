"use client";

// The severance confirmation (design.md §8.5). It serves both routes to
// `(0, 0)`: the explicit gesture, and an ordinary pick that happens to
// land the bundle there — the second is confirmed, never refused,
// because the control never prevents a choice (§8.2). The two are the
// SAME dialog, distinguished only by the pick line the second one adds.
//
// The order is fixed (Android parity): title · the pick line when it was
// reached by a pick · the consequences · where you stand now · the cost ·
// the failure line when one exists · Keep it, Sever — the confirming
// action on the right, the platform convention (F7).
//
// The batch size is the legible cost (api-spec.md "A prepare may stage a
// batch"): each counter-record is its own priced act, so the count is
// what the reader needs before signing.
//
// A native <dialog>, like the join prompt: focus trapping, Esc, and the
// backdrop come from the platform rather than from hand-rolled handlers.

import { useEffect, useRef } from "react";

import { nearestAnchor } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import { buttonClassName } from "@/lib/ui/button";
import { severanceStandingLine, standingLine, type BundleState } from "@/lib/ui/stance-readout";

export function SeveranceConfirm({
  pick,
  targetLabel,
  bundle,
  records,
  alreadySevered = false,
  busy = false,
  failed = false,
  onConfirm,
  onCancel,
}: {
  /** The pick that reached this dialog; null on the explicit gesture. */
  pick: StancePair | null;
  /** Already in the reader's words — "this post", "@ada". */
  targetLabel: string;
  /** The standing, for the line that states it. */
  bundle: BundleState;
  /** How many signed actions reaching zero takes. */
  records: number;
  /** The fold reports nothing left to walk back — severing is a no-op. */
  alreadySevered?: boolean;
  busy?: boolean;
  /** The signing pass did not complete; the dialog stays open and says so. */
  failed?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  const actions = records === 1 ? "1 signed action" : `${records} signed actions`;
  const pickAnchor = pick === null ? null : nearestAnchor(pick);

  return (
    <dialog
      ref={ref}
      data-testid="severance-confirm"
      onClose={onCancel}
      className="m-auto w-[min(90vw,22rem)] rounded-extra-large bg-surface-container-high p-6 text-left text-on-surface backdrop:bg-scrim/50"
    >
      <h2 className="text-headline-small">Sever this?</h2>
      {pickAnchor !== null && (
        <p data-testid="severance-pick" className="mt-2 text-body-medium">
          Your pick: {pickAnchor.emoji} {pickAnchor.label}
        </p>
      )}
      {/* Not `error` colouring: severance is a deliberate choice, not a
          failure (design.md §2.4). */}
      <p
        data-testid="severance-consequences"
        className="mt-2 text-body-medium text-on-surface-variant"
      >
        Your standing toward {targetLabel} drops to nothing. It stops reaching your feed, you stop
        earning from it, and nothing passes on through you.
      </p>
      <p
        data-testid="severance-standing"
        className="mt-2 text-body-small text-on-surface-variant"
      >
        {standingLine(bundle, targetLabel)}
      </p>
      {/* The RAW sums, not the clipped fold: they are what a walk back
          to zero actually walks (design.md §8.3, §8.5). */}
      <p data-testid="severance-raw" className="mt-1 text-body-small text-on-surface-variant">
        {severanceStandingLine(bundle, targetLabel)}
      </p>
      <p data-testid="severance-cost" className="mt-2 text-body-medium">
        {alreadySevered
          ? "You are already at nothing here."
          : `It takes ${actions}, each paid for separately.`}
      </p>
      {failed && (
        <p role="alert" data-testid="severance-failed" className="mt-2 text-body-medium text-error">
          That didn&apos;t send. Try again.
        </p>
      )}
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
          disabled={busy || alreadySevered}
          onClick={onConfirm}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          Sever
        </button>
      </div>
    </dialog>
  );
}
