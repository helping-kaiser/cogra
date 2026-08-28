import React from "react";

/* Chips (backlog items 4 and 8).

   TWO CHIPS, ONE SHAPE. A `Chip` is a filter the reader turns on and off; a
   `TopicChip` is a topic that goes somewhere. They look alike on purpose — both
   are a word in a pill — and they are told apart by what they do, which is the
   same test that separates a button from a link (§7).

   WHEN A CHIP AND NOT A SEGMENTED FILTER. Chips are for a set the reader can
   combine, or one that grows: seven kinds of ranked content, an open list of
   topics. A segmented filter is for two to four alternatives where exactly one
   is true. Using chips for the exclusive case loses "one of these" ; using a
   segmented row for the combinable case loses the combination.

   32px drawn, 48px tapped: `cg-hit` grows the target without inflating a row of
   seven of them past the height of the screen. Selection is
   `secondaryContainer`, colour only \u2014 no check glyph, because a leading check on
   the selected chips reflows every label in the row as the reader picks. */

const PILL = {
  display: "inline-flex",
  alignItems: "center",
  position: "relative",
  height: "32px",
  padding: "0 var(--space-3)",
  borderRadius: "var(--radius-full)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label-large)",
  lineHeight: "var(--text-label-large--line-height)",
  letterSpacing: "var(--text-label-large--letter-spacing)",
  fontWeight: "var(--text-label-large--font-weight)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  textDecoration: "none",
};

export function Chip({ label, selected = false, onToggle, ariaLabel, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className="cg-state cg-focus cg-hit"
      style={{
        ...PILL,
        border: selected ? "1px solid transparent" : "1px solid var(--border-field)",
        background: selected ? "var(--secondary-container)" : "transparent",
        color: selected ? "var(--on-secondary-container)" : "var(--text-body)",
        opacity: disabled ? "var(--state-disabled)" : 1,
      }}
    >
      {label}
    </button>
  );
}

/* A topic. The `#` is part of the word, not an icon: readers type it, and a topic
   without it reads as a name. It navigates, so it is an anchor. */
export function TopicChip({ topic, href, onClick, inert = false, style: override }) {
  const name = topic.replace(/^#/, "");
  const style = {
    ...PILL,
    border: "1px solid var(--border-hairline)",
    background: "var(--surface-card)",
    color: "var(--text-body)",
    ...override,
  };
  // The inert cut: the same pill inside a larger tap target (the detail card's
  // topics line is ONE control opening the sheet) — a link nested in a button
  // is two controls fighting over one press, and invalid markup besides.
  if (inert) return <span style={style}>#{name}</span>;
  return (
    <a href={href ?? `/t/${name}`} onClick={onClick} className="cg-state cg-focus cg-hit" style={style}>
      #{name}
    </a>
  );
}
