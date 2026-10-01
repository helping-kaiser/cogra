import React from "react";
import { InlineAction } from "../core/Button.jsx";

/* The house connectivity alert, and the signing-didn't-finish line. These DO carry
   `error` colouring, because they are genuine failures — unlike the honesty
   markers beside them.

   Where a fault surfaces matters: a failed refresh sits on a banner above the
   content, a failed page fetch sits in place of the load-more control. With posts
   already on screen the fault means "stale", not "gone", so the wording changes and
   the loaded content stays readable underneath. */

export function TransportError({ message }) {
  return (
    <p role="alert" style={{ margin: 0, fontSize: "var(--text-body-medium)", color: "var(--text-failure)" }}>
      {message ?? "Can't reach the server. Check your connection and try again."}
    </p>
  );
}

/* Honest about who acts next: with the key absent the write waits on the reader
   restoring it, not on time passing — "stays pending" alone read as
   wait-and-it-happens.

   `row` IS THE LINE A TARGET'S ROW CARRIES (jakob, the failure pack: vehicle
   (b), the Snackbar charter untouched). A press-and-hold signs with no
   surface of its own to re-raise when it fails, so the fault stands where
   the gesture was given — under the face, on the target's own affordance
   row, in the slot the pending marker uses. The row is one line of controls
   by rule, so the words are the short ones and the type is the pending
   marker's `label-small`: the fact in `--text-failure`, then `Retry` as a
   bare word at the end of the line (`InlineAction`, the upload error's
   shape).

   `quiet` IS THE WRITE RULE'S ROW LINE (jakob 2026-10-01, backlog item 117).
   The write rule's refusal is a notice, not a fault — nothing was staged or
   spent — so its line never takes `--text-failure`: it is the pending
   marker's register, `--text-secondary`, announced politely
   (`role="status"`), and it carries no Retry, because asking again at once
   meets the same answer. The word is gone, never disabled. */
export function SigningPending({ needsKey = false, restoreHref = "/restore", row = false, quiet = false, message, onRetry }) {
  if (row) {
    return (
      <p
        role={quiet ? "status" : "alert"}
        style={{
          margin: 0,
          fontSize: "var(--text-label-small)",
          lineHeight: "var(--text-label-small--line-height)",
          fontWeight: "var(--text-label-small--font-weight)",
          letterSpacing: "var(--text-label-small--letter-spacing)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: quiet ? "var(--text-secondary)" : "var(--text-failure)" }}>{message ?? "That didn't sign."}</span>
        {onRetry && !quiet && (
          <>
            {" "}
            <InlineAction size="sm" onClick={onRetry}>
              Retry
            </InlineAction>
          </>
        )}
      </p>
    );
  }
  return (
    <p role="alert" style={{ margin: 0, fontSize: "var(--text-body-medium)", color: "var(--text-failure)" }}>
      {needsKey ? (
        <>
          Signing needs your key, which isn&apos;t in this browser — the write waits as pending.{" "}
          <a href={restoreHref} style={{ color: "inherit" }}>
            Restore your key
          </a>{" "}
          to finish it.
        </>
      ) : (
        "Signing did not finish — the write stays pending."
      )}
    </p>
  );
}
