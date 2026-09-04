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
   the selected chips reflows every label in the row as the reader picks.

   Both wear the same PILL and the same size rung, because a size the topic half
   of the family does not understand is exactly the drift this file exists to
   prevent. */

const PILL = {
  display: "inline-flex",
  alignItems: "center",
  position: "relative",
  borderRadius: "var(--radius-full)",
  fontFamily: "var(--font-sans)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  textDecoration: "none",
};

/* TWO SIZES, ONE PILL. `md` is the chip proper — a control the thumb reaches,
   32px drawn and 48px tapped. `sm` is the same pill 24px tall on `label-small`,
   and it is a READOUT rather than a control: the topics inside the acts card,
   where the reader is being shown what a signature will carry, not offered
   something to press. That is why the small rung does not get a smaller tap
   target — nothing at this size is meant to be tapped. Where a control must be
   small, it stays `md` and the row loses a word instead. */
const SIZES = {
  md: {
    height: "32px",
    padding: "0 var(--space-3)",
    fontSize: "var(--text-label-large)",
    lineHeight: "var(--text-label-large--line-height)",
    letterSpacing: "var(--text-label-large--letter-spacing)",
    fontWeight: "var(--text-label-large--font-weight)",
  },
  sm: {
    height: "24px",
    padding: "0 var(--space-2)",
    fontSize: "var(--text-label-small)",
    lineHeight: "var(--text-label-small--line-height)",
    letterSpacing: "var(--text-label-small--letter-spacing)",
    fontWeight: "var(--text-label-small--font-weight)",
  },
};

export function Chip({ label, selected = false, onToggle, ariaLabel, disabled = false, size = "md" }) {
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
        ...SIZES[size] ?? SIZES.md,
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
export function TopicChip({ topic, href, onClick, inert = false, size = "md", style: override }) {
  const name = topic.replace(/^#/, "");
  const style = {
    ...PILL,
    ...SIZES[size] ?? SIZES.md,
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
