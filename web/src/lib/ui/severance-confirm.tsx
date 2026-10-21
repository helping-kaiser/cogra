"use client";

// THE SEVERANCE CONFIRMATION (`design/components/stance/SeveranceConfirm.jsx`
// and its prompt). It serves both routes to `(0, 0)`: the explicit gesture,
// and an ordinary pick that happens to land the bundle there — the second is
// confirmed, never refused, because the control never prevents a choice. The
// two are the SAME dialog, distinguished only by the pick line the second
// one adds. It asks over the parked pad, so `Keep it` returns to the pick.
//
// The order is fixed: title · the pick line when it was reached by a pick ·
// the consequences · what the reader has said in total (and, only when it
// exceeds the clip, the cap as an aside) · the cost in things · the failure
// line when one exists · the way out.
//
// EVERY WORD OF IT IS THE RECORD FAMILY'S: a person is walked back, a topic
// is disconnected from (`severanceWords`). The SHAPE is the control's.
//
// THE RAW TOTAL LEADS, and these two numbers are THE ONE EXEMPTION FROM GEEK
// MODE (readme §13): they paint in both modes, because the sheet exists to
// show the difference between the raw sum and the fold.
//
// THE SAFE ACTION CARRIES THE EMPHASIS (the destructive-dialog rule): `Keep
// it` is filled and keeps the right-hand slot; the walk-back is a text button
// on the left. Never `error` colouring — severance is a deliberate act.

import { bundleReadout } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import { buttonClassName } from "@/lib/ui/button";
import {
  formatStancePair,
  formatStanceWords,
  severanceWords,
  STANCE_AXES,
  type StanceAxes,
} from "@/lib/ui/stance-format";
import { severanceParts, type BundleState } from "@/lib/ui/stance-readout";
import { DialogSurface } from "@/lib/ui2/dialog-surface";

export function SeveranceConfirm({
  pick,
  targetLabel,
  bundle,
  records,
  alreadySevered = false,
  busy = false,
  slow = false,
  failed = false,
  axes = STANCE_AXES,
  onConfirm,
  onCancel,
}: {
  /** The pick that reached this dialog; null on the explicit gesture. */
  pick: StancePair | null;
  /** Already in the reader's words — "this post", "@ada", "#saltmaps". */
  targetLabel: string;
  /** The standing, for the line that states its raw total. */
  bundle: BundleState;
  /** How many things reaching zero signs. */
  records: number;
  /** The fold reports nothing left to walk back — the one true refusal. */
  alreadySevered?: boolean;
  /** The signing is in flight: the confirm and the ways out are inert. */
  busy?: boolean;
  /** …and has waited past 200ms: the confirm says what is happening. */
  slow?: boolean;
  /** The signing did not complete; the dialog stays open and says so. */
  failed?: boolean;
  /** The record family's words, its way out included. */
  axes?: StanceAxes;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const sever = severanceWords(axes);
  // THE COST IS COUNTED IN THINGS, NOT IN ACTIONS (the geek round).
  const cost =
    records === 1
      ? "It signs 1 thing, paid on its own."
      : `It signs ${records} things, each paid separately.`;
  // A pick at exactly (0, 0) never speaks through the table: here it IS the
  // walk-back, so the zero readout's own face is its honest one.
  const pickReadout = pick === null ? null : bundleReadout(pick, sever.zero);
  const read = severanceParts(bundle, targetLabel);

  return (
    <DialogSurface
      title={sever.title(targetLabel)}
      locked={busy}
      onDismiss={onCancel}
      testId="severance-confirm"
      body={[
        ...(pick !== null && pickReadout !== null
          ? [
              <p key="pick" data-testid="severance-pick" className="m-0">
                <span aria-hidden="true">
                  Your pick: {pickReadout.emoji} {formatStancePair(pick)}
                </span>
                <span className="sr-only">{`Your pick: ${pickReadout.label}, ${formatStanceWords(pick, axes)}`}</span>
              </p>,
            ]
          : []),
        sever.effect(targetLabel),
        // The RAW total leads and the cap is derived from it; the two lines
        // are one statement, so they keep a tight 4px apart.
        "sentence" in read ? (
          <p key="total" data-testid="severance-raw" className="m-0 text-body-small">
            {read.sentence}
          </p>
        ) : (
          <div key="total" data-testid="severance-raw" className="flex flex-col gap-1 text-body-small">
            <p className="m-0">{sever.sum(targetLabel, read.raw)}</p>
            {read.capped && <p className="m-0">Your feed reads it capped at {read.folded}.</p>}
          </div>
        ),
        <p key="cost" data-testid="severance-cost" className="m-0">
          {alreadySevered ? "You are already at nothing here." : cost}
        </p>,
        // A FAILED SIGNING RE-RAISES ITS OWN SURFACE WITH RETRY: the fault
        // stands above the pair, and the confirm's slot reads Retry.
        ...(failed
          ? [
              <p key="failed" role="alert" data-testid="severance-failed" className="m-0 text-error">
                That didn&apos;t send. Try again.
              </p>,
            ]
          : []),
      ]}
      actions={
        <>
          {/* IN FLIGHT THE LABEL SAYS WHAT IS HAPPENING — the family's own
              present participle — and the control is inert, never dimmed.
              Dimming is kept for the one true refusal, a bundle already at
              nothing. */}
          <button
            type="button"
            data-testid="severance-proceed"
            disabled={alreadySevered}
            aria-disabled={busy || undefined}
            aria-busy={slow || undefined}
            onClick={() => {
              if (!busy) onConfirm();
            }}
            className={buttonClassName({ variant: "text" })}
          >
            {slow ? sever.busy : failed ? "Retry" : sever.control}
          </button>
          {/* THE WAYS OUT ARE LOCKED WHILE IT SIGNS: the act was sent from
              this dialog, so `Keep it`, the scrim, Escape and Back wait for
              the answer — locked, never dimmed. */}
          <button
            type="button"
            data-testid="severance-cancel"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onCancel();
            }}
            className={buttonClassName({ variant: "primary" })}
          >
            Keep it
          </button>
        </>
      }
    />
  );
}
