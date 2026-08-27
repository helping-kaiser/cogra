import React from "react";

/* The honesty markers of design.md §9. Nothing vanishes silently, and NONE of
   these use `error` colouring — they are statements of fact, not warnings.

   Both are `label-small` on `onSurfaceVariant`, deliberately the quietest type in
   the system: soft, friendly, not forensic. */

/** Content authored and signed but not yet ordered on L1. Shows in FULL to every
    reader — not just its author — under a quiet line saying it is still settling.
    Nothing is greyed out or held back: the content is real, only its place in the
    order is not. */
export function PendingMarker({ label = "Still settling" }) {
  return (
    <p style={{ margin: 0, fontSize: "var(--text-label-small)", color: "var(--text-secondary)" }}>{label}</p>
  );
}

/** The edit marker: a soft marker with an optional tap to see what changed.
    Friendly, not forensic. */
export function EditedMarker({ label = "Edited", onInspect }) {
  if (!onInspect) {
    return <p style={{ margin: 0, fontSize: "var(--text-label-small)", color: "var(--text-secondary)" }}>{label}</p>;
  }
  return (
    <button
      type="button"
      onClick={onInspect}
      style={{
        alignSelf: "flex-start",
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label-small)",
        color: "var(--text-secondary)",
        textDecoration: "underline",
      }}
    >
      {label}
    </button>
  );
}
