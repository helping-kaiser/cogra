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

   copy-voice's *The two hard rules about numbers* binds figures: every number shown is EXPLAINABLE —
   traceable, on demand, to what produced it, because a figure with no path behind
   it is the black box again, just smaller — and detail is LAYERED: a calm surface
   by default, the arithmetic a tap away.

   So this is one thing: a quiet figure that opens its explanation. It does not
   render the explanation. There is no expand-in-place variant, because the
   product's one figure is the score every ranked card wears — the Feed score,
   one figure and one name on every kind of card — and its
   explanation is four screens deep, not three rows.
   Nothing here is designed against a number that does not exist yet — earnings
   included.

   Register: `body-small` on `onSurfaceVariant`. Never a badge, never a colour,
   never a trend arrow. Growth-dashboard framing is the failure mode readme §2
   names among its anti-goals. */

/* OVER MEDIA (jakob, review round 1): on the stream this figure sits on the
   clip, where onSurfaceVariant on photography is not quiet but unreadable. It
   goes white with a shadow — the register is unchanged, the contrast is not. */

/* THE FIGURE IS DRAWN WHATEVER THE READING MODE SAYS (jakob's ruling, the geek
   round's review). Geek mode governs the number PAIRS — the two-parameter
   readings the faces and the tag objects already stand in for — and nothing
   else. A Feed score has no glyph that carries its magnitude, so hiding the
   digits would leave the `graph` mark saying only "there is a score", which is
   the black box §7 exists to refuse. */
/* THE SCORE'S STRING, ONE RULE FOR EVERY PLACE IT PRINTS (jakob 2026-11-12,
   the re-ask's twentieth; seam 293-2, 310). A computed score `s` is `tiny`
   when 0 < |s| < 0.005 — the scores two decimals would print as `0.00`.
   · THE CARD — this master's `value` on every ranked card, the tag page's
     cards included: two decimals, never more, rounded half away from zero; a
     tiny score rounds AWAY from zero, `0.01` above it and `−0.01` below. So
     the card reads `0.00` only for a score that is exactly zero — a severed
     one — and a reader never meets a computed figure that looks like none.
   · THE TRACE — every figure behind the graph glyph: the held thing's flag,
     each path's figure, a path's `adds`: two decimals as on
     the card, and a tiny one in two significant digits instead — its
     magnitude rounded to two significant digits and written in plain
     decimals (`0.0031`, `0.00042`, `0.000050`, `0.0010`), then cut to at most
     six decimals, rounded half away from zero; a magnitude that then reads
     `0.000000` reads `0.000001`. The trace's own sign rule stands: a positive
     takes `+` there (`+0.0031`), a negative its `−` (`−0.00042`, `−0.000001`).
     A tiny path prints its exact figure by this rule among paths that print
     two decimals, and the paths add up to the score to the cent (jakob
     2026-11-13, N6).
   · THE MINUS IS U+2212 everywhere (readme §3), never a hyphen.
   · SPOKEN, a screen reader reads the printed figure, never the computed
     one: `Feed score`, then exactly what the slot prints.
   The stored and the wire value keep their full precision; only the string
   follows this rule. */
/* A PENDING MARK UNDER THE GLYPH, INSIDE THE DOOR (round 26, seam 250): the
   stream's settling face is the bare glyph with `Still settling` under it, and
   the whole face is the door. `pending` carries those words; the door then
   stacks them under its glyph row, which keeps the 48px it stood in, so the
   glyph does not move. Its part is `settling`. */
export function ExplainableNumber({ label, value, unit, glyph, onOpenDetail, overMedia = false, pending, node }) {
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className="cg-state cg-focus cg-hit"
      style={{
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        ...(pending ? { flexDirection: "column", gap: 2 } : { gap: "6px", minHeight: "var(--touch-target-min)" }),
        border: 0,
        background: "none",
        borderRadius: "var(--radius-full)",
        padding: "0 8px",
        margin: "0 -8px",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-small)",
        lineHeight: "var(--text-body-small--line-height)",
        letterSpacing: "var(--text-body-small--letter-spacing)",
        fontWeight: "var(--text-body-small--font-weight)",
        color: overMedia ? "#fff" : "var(--text-secondary)",
        textAlign: "left",
        ...(overMedia ? { filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" } : null),
      }}
      data-node={node}
    >
      {pending ? (
        <>
          <span style={{ display: "inline-flex", alignItems: "center", minHeight: "var(--touch-target-min)" }}>
            {glyph && <Icon name={glyph} size={18} />}
            <span style={SR_ONLY}>{label}</span>
          </span>
          <span
            style={{
              maxWidth: 56,
              textAlign: "center",
              fontSize: "var(--text-label-small)",
              letterSpacing: "var(--text-label-small--letter-spacing)",
              lineHeight: "var(--text-label-small--line-height)",
              fontWeight: "var(--text-label-small--font-weight)",
              color: overMedia ? "#fff" : "var(--text-secondary)",
            }}
            data-node={node && "settling"}
          >
            {pending}
          </span>
        </>
      ) : null}
      {/* A GLYPH, NOT AN EMOJI. The product's only emoji vocabulary is the stance
          readout, and a face on a post card already means "your opinion" — a second
          face meaning something else would make both unreadable. The label lives
          in the accessibility tree instead, which also keeps the affordance row on
          one line. */}
      {pending ? null : glyph ? (
        <>
          <Icon name={glyph} size={18} />
          <span style={SR_ONLY}>{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
      {/* Uncapped, and negative is ordinary: a minus sign, and NO colour. `error`
          is failure only — a score below zero is a fact about reach, not a fault,
          and colouring it red would editorialise it the way readme §4, *Colour*, forbids for a
          negative stance. */}
      {/* NO VALUE, NO FIGURE (ruling 90; the rail's settling door, RL-G7): a
          figure still settling has nothing to show, and anything drawn in its
          place — a 0, a dash — would say something false. The glyph stands
          bare and the door still opens. A DASH is a value, passed as one: the
          figure that is not computed (the trace found no paths). */}
      {!pending && value !== undefined && value !== null && (
        <span style={{ color: overMedia ? "#fff" : "var(--on-surface)", fontWeight: 500 }} data-node={node && "value"}>
          {value}
          {unit ? <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>{unit}</span> : null}
        </span>
      )}
    </button>
  );
}
