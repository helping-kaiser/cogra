import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { BUTTON_CLASS } from "../core/Button.jsx";

/* "This creates 2 signed actions ⌄" (item 17, the conformance round): the one
   line above the sign button on the edit wizards, saying how much a signature
   commits before it is given.

   IT IS THE SHORT FORM OF `ActsCard`. Where a seal has room, the card lists
   every act with its own count and the all-or-nothing subline; where the
   screen is an edit and the acts are the obvious consequence of what was just
   typed, the same fact rides on one centred line and the chevron says the
   detail is there for the asking. Same sentence either way — an author who
   opens the card should read the number they already saw.

   IT SITS DIRECTLY ON THE BUTTON IT QUALIFIES, with no gap of its own: the
   footer is the last thing before Sign, and the spacer above it is what pushes
   the pair to the bottom of the column. That order is the point — the count is
   read on the way to the button, not after it.

   THE WHOLE LINE IS THE BUTTON (jakob's ruling, the conformance round), not
   the chevron: a 16px glyph is not a target, and the sentence is what the
   author is reading when they decide they want the detail. It carries no
   label of its own — the sentence IS the name, which is the only name that
   would be right. The button adds no box: no border, no background, no
   padding, the type spelled out because a button inherits none of it — so
   the line is drawn exactly as before, and the state layer, the focus ring
   and the 48px target arrive with `BUTTON_CLASS`. */

export function ActsFooter({ count, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={BUTTON_CLASS}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, border: 0, background: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}
    >
      This creates {count} signed actions
      <span style={{ display: "inline-flex" }}>
        <Icon name="expand_more" size={16} />
      </span>
    </button>
  );
}
