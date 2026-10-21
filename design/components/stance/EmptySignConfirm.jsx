import React from "react";
import { DialogSurface } from "../core/JoinPrompt.jsx";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";

/* THE EMPTY SIGN (jakob 2026-10-21, seam 242). A pick whose landing is
   exactly (0, 0) while nothing stands — no record ever signed toward the
   target, or a bundle already walked back to nothing — is not a walk-back:
   there is nothing to walk back. It is a priced record that says nothing —
   signed, it joins the bundle like any other record and the fold stays at
   (0, 0), never severed. So it gets its own ask, never
   `SeveranceConfirm`, and never a block: the control never prevents a choice,
   and `Set it anyway` is always there — the compose pad's `Start it
   unreachable?` pattern.

   THE SHAPE IS `SeveranceConfirm`'s, because it is the same moment on the
   same pad: the dialog vehicle (`DialogSurface`, readme §11), the pad still
   parked beneath it, and the destructive-dialog rule — the SAFE action,
   `Keep it`, filled and in the right-hand slot the thumb goes to by habit,
   the act a text button on the left, one tap away. No `error` colour: an
   empty sign is a choice, not a fault.

   TWO LINES, EACH ONE NEW (jakob's hard rule, round 18: never state the
   expected). The first says what the record does — nothing about the target,
   nothing in any feed, and no move from where the reader stands, which is the
   one thing a reader who knows the walk-back would assume otherwise. The
   second is the cost, in things, as every signature's is counted — the
   severance dialog's own sentence for one record.

   IT SIGNS LIKE ANY SET, and confirms like one: the ordinary snackbar, the
   ordinary bundle (jakob 2026-10-21). `busy` and `failed` are the failure pack's, exactly
   as `SeveranceConfirm` carries them: past 200ms the act reads Set's own
   participle and goes inert, never dimmed; a signing that did not go through
   keeps the dialog up with the fault line and `Retry` in the act's slot.

   WHERE THE OPINION VOUCHES SOMEONE IN, IT WARNS HARDER (jakob 2026-10-21).
   Approving an applicant, or answering a vouch asked for, signs the opinion
   that brings them in — and an empty one still does: `Set it anyway` is the
   act, and the vouch-in proceeds. Blocking makes no sense; the approver could
   walk it back a moment later. But the person it lands on starts cut off —
   no feed carries them and community funds stay closed to them until someone
   holds an opinion of them that says something — and that is the one new
   fact, so it takes the first line's place. `vouchIn` draws it. */
export const EMPTY_SIGN_WORDS = {
  title: "Sign an empty opinion?",
  effect: (targetLabel) => `This says nothing about ${targetLabel}, shapes no feed, and leaves you where you are.`,
  vouchIn: (targetLabel) =>
    `${targetLabel} would be vouched in but start out cut off: no feed can carry them, and community funds stay closed to them, until someone gives them an opinion that says something.`,
  cost: "It signs 1 thing, paid on its own.",
  confirm: "Set it anyway",
  busy: "Setting…",
  keep: "Keep it",
};

export function EmptySignConfirm({ targetLabel, vouchIn = false, busy = false, failed = false, onConfirm, onCancel, inline = false }) {
  const words = EMPTY_SIGN_WORDS;
  return (
    /* The scrim, Escape and Back take `Keep it`, the safe answer — and wait,
       as it does, while the act signs. */
    <DialogSurface
      inline={inline}
      onScrimPress={busy ? undefined : onCancel}
      title={words.title}
      body={[
        vouchIn ? words.vouchIn(targetLabel) : words.effect(targetLabel),
        words.cost,
        failed && (
          <p role="alert" style={{ margin: 0, color: "var(--text-failure)" }}>
            That didn&apos;t send. Try again.
          </p>
        ),
      ].filter(Boolean)}
      actions={
        <>
          <button
            type="button"
            onClick={busy ? undefined : onConfirm}
            aria-busy={busy || undefined}
            aria-disabled={busy || undefined}
            className={BUTTON_CLASS}
            style={buttonStyle({ variant: "text", busy })}
          >
            {busy ? words.busy : failed ? "Retry" : words.confirm}
          </button>
          <button
            type="button"
            onClick={busy ? undefined : onCancel}
            aria-disabled={busy || undefined}
            className={BUTTON_CLASS}
            style={buttonStyle({ variant: "primary", busy })}
          >
            {words.keep}
          </button>
        </>
      }
    />
  );
}
