"use client";

// THE TWO CLOSING DIALOGS (RejectConfirm.jsx, RejectAllConfirm.jsx; behavior
// RejectConfirm.md, RejectAllConfirm.md), over the Invites page. One drawing
// serves both — a row's close and a group's `Close all` — and they differ only
// in their words, which the caller hands in.
//
// THE QUIET ANSWER COMMITS, THE FILLED ONE KEEPS: `Keep it` / `Keep them` is
// the filled answer in the right-hand slot and `Close it` / `Close them` the
// text button on its left (RejectConfirm.md:9). No error colour and no
// deletion language: closing removes nothing from the record (:11, :21).
//
// THE CLOSING WAITS FOR ITS ANSWER (:15-17): pressed, the dialog stays up and
// locked — scrim, Back and Escape do nothing — the commit refuses a second
// press and is never dimmed, and past 200ms it reads `Closing it…`. A closing
// that did not go through keeps the dialog with its pair, says `That didn't
// send. Try again.` and the commit reads `Retry` (:23).

import { useEffect, useRef, useState } from "react";

import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { DialogSurface } from "@/lib/ui2/dialog-surface";
import { DIDNT_SEND, RETRY } from "@/lib/invites/queue";
import { NOT_THROUGH_LINE } from "@/lib/ui/error-messages";

/**
 * What a closing answered: taken, no answer, or the server's FORBIDDEN —
 * an answer, so its line is the not-through one (NetworkError.md:13).
 */
export type CloseAnswer = "taken" | "failed" | "notThrough";

/** How long a closing may stay unanswered before it says it is still working. */
export const CLOSING_AFTER_MS = 200;

const DIALOG: DataNode = { path: "invites.dialog" };

export function CloseDialog({
  title,
  body,
  commitLabel,
  busyLabel,
  keepLabel,
  onCommit,
  onDismiss,
}: {
  title: string;
  body: readonly string[];
  commitLabel: string;
  busyLabel: string;
  keepLabel: string;
  /** The closing itself, and what it answered. */
  onCommit: () => Promise<CloseAnswer>;
  /** Keep, the scrim, Back or Escape: nothing is closed. */
  onDismiss: () => void;
}) {
  const [inFlight, setInFlight] = useState(false);
  const [slow, setSlow] = useState(false);
  const [fault, setFault] = useState<Exclude<CloseAnswer, "taken"> | null>(null);
  const failed = fault !== null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const commit = async () => {
    if (inFlight) return;
    setInFlight(true);
    setFault(null);
    timer.current = setTimeout(() => setSlow(true), CLOSING_AFTER_MS);
    const answer = await onCommit();
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setSlow(false);
    setInFlight(false);
    // A closing taken unmounts this dialog through its caller.
    if (answer !== "taken") setFault(answer);
  };

  return (
    <DialogSurface
      title={title}
      body={body}
      onDismiss={onDismiss}
      locked={inFlight}
      node={DIALOG}
      actions={
        <>
          <button
            type="button"
            onClick={inFlight ? undefined : () => void commit()}
            aria-busy={inFlight || undefined}
            aria-disabled={inFlight || undefined}
            className={buttonClassName({ variant: "text" })}
            {...testAttributes(part(DIALOG, "close"))}
          >
            {slow ? busyLabel : failed ? RETRY : commitLabel}
          </button>
          <button
            type="button"
            onClick={inFlight ? undefined : onDismiss}
            aria-disabled={inFlight || undefined}
            className={buttonClassName({ variant: "primary" })}
            {...testAttributes(part(DIALOG, "keep"))}
          >
            {keepLabel}
          </button>
        </>
      }
    >
      {failed && (
        // The failure voice inside the dialog, never a snackbar (:23).
        <p role="alert" data-testid="invites-dialog-failed" className="m-0 mt-4 text-body-medium text-error">
          {fault === "notThrough" ? NOT_THROUGH_LINE : DIDNT_SEND}
        </p>
      )}
    </DialogSurface>
  );
}
