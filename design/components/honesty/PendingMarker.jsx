import React from "react";

/* The honesty markers of readme §9. Nothing vanishes silently, and NONE of
   these use `error` colouring — they are statements of fact, not warnings.

   Both are `label-small` on `onSurfaceVariant`, deliberately the quietest type in
   the system: soft, friendly, not forensic. */

/** Content authored and signed but not yet ordered on L1. Shows in FULL to every
    reader — not just its author — under a quiet line saying it is still settling.
    Nothing is greyed out or held back: the content is real, only its place in the
    order is not.

    `inline` is the phrasing form, for a marker that lands inside a row which is
    itself a button: a `<button>` takes phrasing content, so a `<p>` inside one is
    illegal markup. Same two tokens, same words — only the box changes. */
export function PendingMarker({ label = "Still settling", inline = false, node }) {
  const ink = { fontSize: "var(--text-label-small)", color: "var(--text-secondary)" };
  if (inline) return <span style={ink} data-node={node}>{label}</span>;
  return <p style={{ margin: 0, ...ink }} data-node={node}>{label}</p>;
}

/** The edit marker: a soft marker with an optional tap onto the edit history —
    every version whole, newest first, never a diff. Friendly, not forensic.
    V1.0 PASSES NO HISTORY DOOR (readme §13, the scope cut's F-1): no canonical
    screen hands `onInspect`, so the marker renders as plain text and no door
    exists in V1.0. The change-histories round wires it.

    AS A DOOR IT IS A PRESSABLE LIKE ANY OTHER (readme §4, the K13 round):
    `cg-state cg-focus cg-hit`, so the label-small ink answers to a 48px target
    with the pressed layer and the focus ring every control carries. */
export function EditedMarker({ label = "Edited", onInspect }) {
  if (!onInspect) {
    return <p style={{ margin: 0, fontSize: "var(--text-label-small)", color: "var(--text-secondary)" }}>{label}</p>;
  }
  return (
    <button
      type="button"
      onClick={onInspect}
      className="cg-state cg-focus cg-hit"
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
