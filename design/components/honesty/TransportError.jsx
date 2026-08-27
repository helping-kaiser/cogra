import React from "react";

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
   wait-and-it-happens. */
export function SigningPending({ needsKey = false, restoreHref = "/restore" }) {
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
