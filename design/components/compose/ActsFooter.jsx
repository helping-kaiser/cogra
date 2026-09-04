import React from "react";
import { Icon } from "../navigation/Icon.jsx";

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

   THE CHEVRON IS DRAWN, NOT WIRED. All four boards show it inert, and whether
   it opens the acts card is a ruling nobody has made — so the master draws
   what was designed and takes no handler it would only pretend to honour.
   When the ruling comes, the whole line becomes the button, not the glyph:
   a 16px chevron is not a target. */

export function ActsFooter({ count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
      This creates {count} signed actions
      <span style={{ display: "inline-flex" }}>
        <Icon name="expand_more" size={16} />
      </span>
    </div>
  );
}
