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

/* OVER MEDIA (jakob, review round 1): on the stream this figure sits on the
   clip, where onSurfaceVariant on photography is not quiet but unreadable. It
   goes white with a shadow — the register is unchanged, the contrast is not. */

/* `exact` SAYS THIS FIGURE IS A SIGNAL NUMBER (backlog item 53). The Post Score
   is one and sets it: the `graph` glyph carries the reading, and the digits ride
   a `cg-exact` span that paints only in geek mode (readme §13). Money, ages and
   counts are not signal numbers and never set it — hiding what something costs
   trades honesty for aesthetics, which is the opposite trade to this one.

   THE EM-DASH PLACEHOLDER RIDES THE SAME SPAN. A post whose score has not
   settled yet draws `—` where the number goes, and that is a number-shaped
   readout of the same fact: in geek mode it says "no figure yet", and with the
   digits off there is nothing for it to stand in for. The glyph alone is the
   honest drawing either way, and one span means the two modes cannot disagree
   about where the figure sits.

   The glyph, the target and the geometry never move with the mode: only the
   digits paint or do not. */
export function ExplainableNumber({ label, value, unit, glyph, onOpenDetail, overMedia = false, exact = false }) {
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className="cg-state cg-focus cg-hit"
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
        color: overMedia ? "#fff" : "var(--text-secondary)",
        textAlign: "left",
        ...(overMedia ? { filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" } : null),
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
      <span
        className={exact ? "cg-exact" : undefined}
        aria-hidden={exact ? "true" : undefined}
        style={{ color: overMedia ? "#fff" : "var(--on-surface)", fontWeight: 500 }}
      >
        {value}
        {unit ? <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>{unit}</span> : null}
      </span>
      {/* The figure is spoken in both modes: the mode draws, it does not redact. */}
      {exact && (
        <span style={SR_ONLY}>
          {value}
          {unit}
        </span>
      )}
    </button>
  );
}
