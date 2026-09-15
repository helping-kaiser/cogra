import React from "react";
import { DialogSurface } from "../core/JoinPrompt.jsx";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";
import {
  bundleReadout,
  severanceParts,
  severanceWords,
  formatStancePair,
  formatStanceWords,
  STANCE_AXIS_NAMES,
  SR_ONLY,
} from "./StanceReadout.jsx";

// The severance confirmation (design.md §8.5). It serves both routes to (0, 0):
// the explicit gesture, and an ordinary pick that happens to land the bundle
// there — the second is confirmed, never refused, because the control never
// prevents a choice (§8.2). The two are the SAME dialog, distinguished only by
// the pick line the second one adds.
//
// The order is fixed (Android parity): title · the pick line when it was reached
// by a pick · the consequences · what the reader has said in total (and, only when
// it exceeds the clip, the cap as an aside) · the cost · the failure line when one
// exists · the way out, Keep it.
//
// EVERY WORD OF IT IS THE RECORD FAMILY'S (jakob 2026-09-15). The dialog's
// title, its two sentences and the button that confirms come from the family's
// own severance words, the way its axes already do: a person is walked back, a
// topic is disconnected from, and neither register is made to serve the other.
// The SHAPE is the control's and does not vary — same order, same safe action
// on the right, same raw-total-first arithmetic.
//
// THE RAW TOTAL LEADS. §8.3 requires the raw sums on every surface that explains
// cost, because they are what a walk back to zero actually walks — but stating the
// clipped fold first and the raw sum second reads as broken arithmetic ("my opinion
// is +1.00, so why does walking it back take +1.40?"). The total is what the
// reader built up; the cap is what routing reads of it. In that order it explains
// itself.
//
// DIVERGENCE FROM THE SOURCE, deliberate: the source draws both actions as text
// buttons of equal weight. On a destructive dialog that is a coin flip — two
// identical-looking words, one of which is irreversible and priced. Here the SAFE
// action carries the emphasis (filled) and keeps the right-hand slot the thumb
// goes to by habit, while the way out stays a text button on the left. It is still
// reachable in one tap, so the control still never prevents the choice; it just
// stops being the default-looking one. No new colour is introduced — severance is
// a deliberate act, not a failure, so `error` stays off this surface (§2.4).
//
// The batch size is the legible cost — each counter-record is its own priced act,
// so the count is what the reader needs before signing. And the line above it
// states the RAW SUMS, not the clipped fold: they are what a walk back to zero
// actually walks.

export function SeveranceConfirm({
  pick = null,
  targetLabel,
  bundle,
  records = 1,
  alreadySevered = false,
  busy = false,
  failed = false,
  onConfirm,
  onCancel,
  inline = false,
  names = STANCE_AXIS_NAMES,
}) {
  /* THE COST IS COUNTED IN THINGS, NOT IN ACTIONS (jakob's ruling, the geek
     round). "Signed action" is the repo's word for a record; what the reader
     has is a pile of things they said, each of which has to be said back. */
  const cost = records === 1 ? "It signs 1 thing, paid on its own." : `It signs ${records} things, each paid separately.`;
  /* A pick at exactly (0, 0) never speaks through the table (readme §8): here
     it IS the walk-back, so the zero readout's own pair — 🤷, "Walked back" —
     is its honest face. */
  const sever = severanceWords(names);
  const title = sever.title(targetLabel);
  const pickAnchor = pick === null ? null : bundleReadout(pick, sever.zero);
  const read = severanceParts(bundle, targetLabel);
  return (
    <DialogSurface ariaLabel={title} inline={inline} onScrimPress={onCancel}>
      <h2
        style={{
          margin: 0,
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
        }}
      >
        {title}
      </h2>
      {pickAnchor !== null && (
        <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)" }}>
          <span aria-hidden="true">
            Your pick: {pickAnchor.emoji} {formatStancePair(pick)}
          </span>
          <span style={SR_ONLY}>{`Your pick: ${pickAnchor.label}, ${formatStanceWords(pick, names)}`}</span>
        </p>
      )}
      <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)", color: "var(--text-secondary)" }}>
        {sever.effect(targetLabel)}
      </p>
      {/* The RAW total leads and the cap is derived from it. The other order — the
          fold first, the sum second — reads as arithmetic that does not work: "my
          opinion is +1.00, so why does walking it back take +1.40?" */}
      {read.sentence !== undefined ? (
        <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>{read.sentence}</p>
      ) : (
        <>
          <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
            {sever.sum(targetLabel, read.raw)}
          </p>
          {read.capped && (
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
              Your feed reads it capped at {read.folded}.
            </p>
          )}
        </>
      )}
      <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)" }}>
        {alreadySevered ? "You are already at nothing here." : cost}
      </p>
      {failed && (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)", color: "var(--text-failure)" }}>
          That didn&apos;t send. Try again.
        </p>
      )}
      <div style={{ marginTop: "var(--space-6)", display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
        <button
          type="button"
          disabled={busy || alreadySevered}
          onClick={onConfirm}
          className={BUTTON_CLASS}
          style={buttonStyle({ variant: "text", size: "sm", disabled: busy || alreadySevered })}
        >
          {sever.control}
        </button>
        <button type="button" onClick={onCancel} className={BUTTON_CLASS} style={buttonStyle({ variant: "primary", size: "sm" })}>
          Keep it
        </button>
      </div>
    </DialogSurface>
  );
}
