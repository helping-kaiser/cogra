import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* Handing a post to the platform's own share sheet (readme §13, the reel round,
   jakob 2026-09-03).

   ONE TAP, NO SURFACE OF OUR OWN. The sheet belongs to the OS — it is where the
   reader's own apps and contacts live, and a share menu drawn here would be a
   worse copy of it that also knows less. So this control has no state, no
   confirmation and no menu: it is the handoff.

   IT RIDES THE ACTION ROW as a glyph, the way the comment count does, and the
   row stays one line. It carries no number, because a share count would be a
   public tally of something the graph does not record.

   IT IS LAST IN THE ROW, and that is a rule rather than a layout: the row's
   order — stance, score, comment, share — is its order of importance, and it is
   also the queue. On a phone too narrow to hold all four, share is the first to
   move into the ⋮ menu. `PostCard` draws it; `showShare={false}` is for a
   surface that has none to offer. */

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
