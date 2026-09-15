import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { BUTTON_CLASS } from "../core/Button.jsx";

/* "You're signing 2 things ⌄" (item 17, the conformance round): the one
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
   and the 48px target arrive with `BUTTON_CLASS`.

   ZERO AND ONE ARE RULED NOW (the topic round, 2026-09-14) — this file said
   they were not, and an unruled wording is a wording every consumer invents.

   AT ONE IT SAYS `1 thing`, which is not a new decision: `ActsCard`'s own total
   already reads `1 thing, signed` on four boards. The two are the same sentence
   at two lengths, and a footer pluralizing where the card does not would make
   the short form say something the long form denies.

   AT ZERO IT STOPS BEING A BUTTON, and that is the load-bearing half. The
   sentence becomes `Nothing to sign yet`, the chevron goes, and the line is a
   plain span — because the acts sheet it would open has nothing in it, and the
   menus round already ruled what to do about a tap that can only open an empty
   list: it is a tap spent on nothing, so it is not offered. The line still
   speaks, because a foot gone silent would read as a fault rather than as a
   state; what it stops doing is promising a detail that isn't there. */

export function ActsFooter({ count, onOpen }) {
  const line =
    count === 0 ? "Nothing to sign yet" : count === 1 ? "You're signing 1 thing" : `You're signing ${count} things`;
  const style = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    border: 0,
    background: "none",
    padding: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-label-small)",
    lineHeight: "var(--text-label-small--line-height)",
    letterSpacing: "var(--text-label-small--letter-spacing)",
    color: "var(--text-secondary)",
  };

  if (count === 0) return <span style={style}>{line}</span>;

  return (
    <button type="button" onClick={onOpen} className={BUTTON_CLASS} style={{ ...style, cursor: "pointer" }}>
      {line}
      <span style={{ display: "inline-flex" }}>
        <Icon name="expand_more" size={16} />
      </span>
    </button>
  );
}
