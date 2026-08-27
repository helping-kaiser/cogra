import React from "react";
import { Icon } from "../navigation/Icon.jsx";

const SR_ONLY = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/* PROPOSED — the shape every number in this product takes, not any one number.

   design.md §7 binds figures with two rules: every number shown is EXPLAINABLE —
   traceable, on demand, to what produced it, because a figure with no path behind
   it is the black box again, just smaller — and detail is LAYERED: a calm surface
   by default, the arithmetic a tap away.

   So this is one thing: a quiet figure that opens its explanation. It does not
   render the explanation. It used to also expand a few rows of arithmetic in
   place; that variant is gone, because the only figure the product has is the Post
   Score, and its explanation is four screens deep, not three rows.
   Nothing here is designed against a number that does not exist yet — earnings
   included.

   Register: `body-small` on `onSurfaceVariant`. Never a badge, never a colour,
   never a trend arrow. Growth-dashboard framing is the failure mode §1 names by
   anti-goal. */

export function ExplainableNumber({ label, value, unit, glyph, onOpenDetail }) {
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className="cg-state cg-focus"
      style={{
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        minHeight: "var(--touch-target-min)",
        border: 0,
        background: "none",
        borderRadius: "var(--radius-full)",
        padding: "0 8px",
        margin: "0 -8px",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-small)",
        color: "var(--text-secondary)",
        textAlign: "left",
      }}
    >
      {/* A GLYPH, NOT AN EMOJI. The product's only emoji vocabulary is the stance
          readout, and a face on a post card already means "your stance" — a second
          face meaning something else would make both unreadable. The label lives
          in the accessibility tree instead, which also keeps the affordance row on
          one line. */}
      {glyph ? (
        <>
          <Icon name={glyph} size={18} />
          <span style={SR_ONLY}>{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
      {/* Uncapped, and negative is ordinary: a minus sign, and NO colour. `error`
          is failure only — a score below zero is a fact about reach, not a fault,
          and colouring it red would editorialise it the way §2.4 forbids for a
          negative stance. */}
      <span style={{ color: "var(--on-surface)", fontWeight: 500 }}>
        {value}
        {unit ? <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>{unit}</span> : null}
      </span>
    </button>
  );
}
