import React from "react";
import { Icon } from "./Icon.jsx";

/* The full-width tab row (item 17, the conformance round, jakob's ruling F):
   equal cells across the surface with a hairline under them, the chosen one in
   primary with a 2px underline. The profile's chronicle draws it with glyphs,
   the stances page with words; they were two copies of one row.

   THE UNDERLINE IS A DELIBERATE DEVIATION from "selection is colour only". An
   icon's colour alone is too quiet to say which of three same-weight glyphs is
   on, and the row is the only thing on the screen that changes what is below
   it. It is drawn as an inset box shadow rather than a border so the cell's
   height does not move when the selection does.

   THE SEGMENTED PILL WAS RULED OUT AT THREE OPTIONS (jakob 2026-09-01): this
   is the row every social profile draws, and a pill that wide stops reading as
   a control.

   A CELL'S KIND IS ITS CONTENT, not a setting. A tab with an `icon` is a glyph
   cell and takes its accessible name from `label`, which is the only way an
   icon-only control can have one. A tab without an icon shows `label` as its
   own words, in `label-large` — and takes NO aria-label, because a button
   whose visible text is its name must not be given a second one to disagree
   with. Deriving this from the tab rather than from a `variant` prop means the
   two can never contradict each other.

   IT IS A GROUP OF TOGGLES, NOT AN ARIA TABLIST. Nothing here controls a
   `tabpanel` — the row filters the list beneath it — so the cells are
   `aria-pressed` buttons inside a labelled group, which is what that pattern
   actually is. */

const CELL = {
  flex: 1,
  display: "grid",
  placeItems: "center",
  minHeight: "var(--touch-target-min)",
  border: 0,
  background: "none",
  padding: 0,
  cursor: "pointer",
};

const WORDS = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label-large)",
  fontWeight: "var(--text-label-large--font-weight)",
  letterSpacing: "var(--text-label-large--letter-spacing)",
};

export function TabBar({ tabs = [], value, ariaLabel, onSelect, iconSize = 22 }) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: "flex", borderBottom: "1px solid var(--border-hairline)" }}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        const chosen = {
          color: selected ? "var(--primary)" : "var(--text-secondary)",
          boxShadow: selected ? "inset 0 -2px 0 var(--primary)" : "none",
        };
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={selected}
            aria-label={tab.icon ? tab.label : undefined}
            onClick={onSelect && (() => onSelect(tab.id))}
            className="cg-state cg-focus"
            style={tab.icon ? { ...CELL, ...chosen } : { ...CELL, ...WORDS, ...chosen }}
          >
            {tab.icon ? <Icon name={tab.icon} size={iconSize} /> : tab.label}
          </button>
        );
      })}
    </div>
  );
}
