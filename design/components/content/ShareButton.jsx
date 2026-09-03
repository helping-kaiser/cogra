import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* Handing a post to the platform's own share sheet (readme §13, the reel round,
   jakob 2026-09-03).

   ONE TAP, NO SURFACE OF OUR OWN. The sheet belongs to the OS — it is where the
   reader's own apps and contacts live, and a share menu drawn here would be a
   worse copy of it that also knows less. So this control has no state, no
   confirmation and no menu: it is the handoff.

   IT RIDES THE AFFORDANCE ROW as a glyph, the way the comment count does, and
   the row stays one line. It carries no number, because a share count would be
   a public tally of something the graph does not record.

   WHERE IT IS DRAWN: the post's detail view and the stream's rail. Whether a
   FEED CARD grows one is open (backlog item 33) and deliberately undrawn — the
   row there is already at its width, and share is the affordance a card can
   most afford to make one tap further away. */

export function ShareButton({ onShare, targetLabel = "this post" }) {
  return (
    <button
      type="button"
      onClick={onShare ?? (() => {})}
      aria-label={`Share ${targetLabel}`}
      className="cg-state cg-focus cg-hit"
      style={{
        display: "flex",
        alignItems: "center",
        border: "none",
        background: "transparent",
        borderRadius: "var(--radius-full)",
        padding: "6px 8px",
        color: "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      <Icon name="share" size={18} />
    </button>
  );
}
