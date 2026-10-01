import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* A feed card's OWN ACT, as a glyph (the feed cards, ruled 2026-10-01).

   Every feed card's row reads opinion · score · the kind's own act · share.
   A post's own act is its comments — `PostCard` draws that button itself,
   with its count. The other kinds' acts take this: a comment's reply (the
   comment glyph, opening its thread at this comment with the composer aimed
   at it) and a tag's `Tag a new post with it` (the compose glyph, opening the
   composer with the tag staged).

   IT IS THE ROW'S ANATOMY, NOT A NEW ONE: the glyph at 18px on
   `text-secondary`, a 48px target grown by `cg-hit`, the same padding the
   share and the comment count wear — so a row of four reads as one row.
   GLYPH ONLY: the words live in the accessible name, which is what keeps the
   row on one line. */

export function GlyphAction({ glyph, label, onPress, node }) {
  return (
    <button
      type="button"
      onClick={onPress ?? (() => {})}
      aria-label={label}
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
      data-node={node}
    >
      <Icon name={glyph} size={18} />
    </button>
  );
}
