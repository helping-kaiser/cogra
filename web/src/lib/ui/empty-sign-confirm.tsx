"use client";

// THE EMPTY SIGN (`design/components/stance/EmptySignConfirm.jsx`, its
// prompt and `EmptySignConfirm.md`; jakob 2026-10-21, seam 242/243). Set on a
// pick whose landing is exactly (0, 0) while NOTHING STANDS toward the target
// — no record ever signed, or a bundle already walked back — walks nothing
// back, so it never opens the walk-back's dialog. It asks instead, and never
// blocks: `Set it anyway` is always one tap away, and signed, the record
// joins the bundle like any other — the ordinary snackbar, the fold at
// (0, 0), never severed.
//
// THE SHAPE IS `SeveranceConfirm`'s, the same moment on the same pad: the
// dialog vehicle over the parked pad, the SAFE action `Keep it` filled in the
// right-hand slot, the act a text button on the left. No error colour — an
// empty sign is a choice, not a fault — the fault line aside.
//
// WHERE THE OPINION VOUCHES SOMEONE IN, IT WARNS HARDER (`vouchIn`): the
// first line becomes the vouch-in warning, and `Set it anyway` still counts
// as the act.
//
// The signing waits and says so (the failure pack): in flight the ways out
// are locked, past 200ms the act reads `Setting…` and goes inert, never
// dimmed; a signing that did not go through keeps the dialog up with the
// fault line, and the act's slot reads `Retry`.

import { buttonClassName } from "@/lib/ui/button";
import { WRITE_RULE_WORDS } from "@/lib/ui/stance-readout";
import { DialogSurface } from "@/lib/ui2/dialog-surface";

/** The dialog's words, verbatim from the master (`EMPTY_SIGN_WORDS`). */
export const EMPTY_SIGN_WORDS = {
  title: "Sign an empty opinion?",
  effect: (targetLabel: string) =>
    `This says nothing about ${targetLabel}, shapes no feed, and leaves you where you are.`,
  vouchIn: (targetLabel: string) =>
    `${targetLabel} would be vouched in but start out cut off: no feed can carry them, and community funds stay closed to them, until someone gives them an opinion that says something.`,
  cost: "It signs 1 thing, paid on its own.",
  confirm: "Set it anyway",
  busy: "Setting…",
  keep: "Keep it",
} as const;

export function EmptySignConfirm({
  targetLabel,
  vouchIn = false,
  busy = false,
  slow = false,
  failed = false,
  writeRule = false,
  onConfirm,
  onCancel,
}: {
  /** Already in the reader's words — "this post", "@ada", "#saltmaps". */
  targetLabel: string;
  /** The opinion vouches its target in: the first line warns they start cut off. */
  vouchIn?: boolean;
  /** The signing is in flight: the act and the ways out are inert. */
  busy?: boolean;
  /** …and has waited past 200ms: the act says what is happening. */
  slow?: boolean;
  /** The signing did not complete; the dialog stays open and says so. */
  failed?: boolean;
  /**
   * THE WRITE RULE'S NO IS `SeveranceConfirm`'S (EmptySignConfirm.md, round
   * 21): the same moment over the same pad, so the same answer — the quiet
   * line where the fault line would stand, `Set it anyway` dimmed, no Retry,
   * and `Keep it` the way back to the pick.
   */
  writeRule?: boolean;
  /** `Set it anyway` — signs the one empty record. */
  onConfirm: () => void;
  /** `Keep it`, the scrim, Escape and Back — the pad beneath keeps its pick. */
  onCancel: () => void;
}) {
  const words = EMPTY_SIGN_WORDS;
  return (
    <DialogSurface
      title={words.title}
      locked={busy}
      onDismiss={onCancel}
      testId="empty-sign-confirm"
      body={[
        <p key="effect" data-testid="empty-sign-effect" className="m-0">
          {vouchIn ? words.vouchIn(targetLabel) : words.effect(targetLabel)}
        </p>,
        <p key="cost" data-testid="empty-sign-cost" className="m-0">
          {words.cost}
        </p>,
        ...(failed
          ? [
              <p key="failed" role="alert" data-testid="empty-sign-failed" className="m-0 text-error">
                That didn&apos;t send. Try again.
              </p>,
            ]
          : []),
        ...(writeRule
          ? [
              <p key="writeRule" role="status" data-testid="empty-sign-write-rule" className="m-0 text-on-surface-variant">
                {WRITE_RULE_WORDS.dialog}
              </p>,
            ]
          : []),
      ]}
      actions={
        <>
          <button
            type="button"
            data-testid="empty-sign-proceed"
            disabled={writeRule}
            aria-disabled={busy || undefined}
            aria-busy={slow || undefined}
            onClick={() => {
              if (!busy) onConfirm();
            }}
            className={buttonClassName({ variant: "text" })}
          >
            {slow ? words.busy : failed ? "Retry" : words.confirm}
          </button>
          <button
            type="button"
            data-testid="empty-sign-keep"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onCancel();
            }}
            className={buttonClassName({ variant: "primary" })}
          >
            {words.keep}
          </button>
        </>
      }
    />
  );
}
