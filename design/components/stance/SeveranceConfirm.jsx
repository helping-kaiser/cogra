import React from "react";
import { DialogSurface } from "../core/JoinPrompt.jsx";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";
import { nearestAnchor, severanceParts, formatStancePair, formatStanceWords, SR_ONLY } from "./StanceReadout.jsx";

// The severance confirmation (design.md §8.5). It serves both routes to (0, 0):
// the explicit gesture, and an ordinary pick that happens to land the bundle
// there — the second is confirmed, never refused, because the control never
// prevents a choice (§8.2). The two are the SAME dialog, distinguished only by
// the pick line the second one adds.
//
// The order is fixed (Android parity): title · the pick line when it was reached
// by a pick · the consequences · what the reader has said in total (and, only when
// it exceeds the clip, the cap as an aside) · the cost · the failure line when one
// exists · Sever, Keep it.
//
// THE RAW TOTAL LEADS. §8.3 requires the raw sums on every surface that explains
// cost, because they are what a walk back to zero actually walks — but stating the
// clipped fold first and the raw sum second reads as broken arithmetic ("my stance
// is +1.00, so why does walking it back take +1.40?"). The total is what the
// reader built up; the cap is what routing reads of it. In that order it explains
// itself.
//
// DIVERGENCE FROM THE SOURCE, deliberate: the source draws both actions as text
// buttons of equal weight. On a destructive dialog that is a coin flip — two
// identical-looking words, one of which is irreversible and priced. Here the SAFE
// action carries the emphasis (filled) and keeps the right-hand slot the thumb
// goes to by habit, while `Sever` stays a text button on the left. It is still
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
}) {
  const actions = records === 1 ? "1 signed action" : `${records} signed actions`;
  const pickAnchor = pick === null ? null : nearestAnchor(pick);
  const read = severanceParts(bundle, targetLabel);
  return (
    <DialogSurface ariaLabel="Sever this?" inline={inline} onScrimPress={onCancel} width="22rem">
      <h2
        style={{
          margin: 0,
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
        }}
      >
        Sever this?
      </h2>
      {pickAnchor !== null && (
        <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)" }}>
          <span aria-hidden="true">
            Your pick: {pickAnchor.emoji} {formatStancePair(pick)}
          </span>
          <span style={SR_ONLY}>{`Your pick: ${pickAnchor.label}, ${formatStanceWords(pick)}`}</span>
        </p>
      )}
      <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)", color: "var(--text-secondary)" }}>
        Your standing toward {targetLabel} drops to nothing. It stops reaching your feed, you stop earning from it, and
        nothing passes on through you.
      </p>
      {/* The RAW total leads and the cap is derived from it. The other order — the
          fold first, the sum second — reads as arithmetic that does not work: "my
          stance is +1.00, so why does walking it back take +1.40?" */}
      {read.sentence !== undefined ? (
        <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>{read.sentence}</p>
      ) : (
        <>
          <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
            Everything you&apos;ve said about {targetLabel} adds up to {read.raw}, and that is what severing walks back.
          </p>
          {read.capped && (
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>
              Your feed reads it capped at {read.folded} — the cap is what routing uses, not what you said.
            </p>
          )}
        </>
      )}
      <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)" }}>
        {alreadySevered ? "You are already at nothing here." : `It takes ${actions}, each paid for separately.`}
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
          Sever
        </button>
        <button type="button" onClick={onCancel} className={BUTTON_CLASS} style={buttonStyle({ variant: "primary", size: "sm" })}>
          Keep it
        </button>
      </div>
    </DialogSurface>
  );
}
