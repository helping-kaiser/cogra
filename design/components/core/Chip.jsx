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

   Both wear the same pill and the same size rung, because a size the topic half
   of the family does not understand is exactly the drift this file exists to
   prevent. */

/* TWO SIZES, ONE PILL. `md` is the chip proper — a control the thumb reaches,
   32px drawn and 48px tapped. `sm` is the same pill 24px tall on `label-small`.
   Neither gets a smaller tap target: where a control must be small, it stays
   `md` and the row loses a word instead. */
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

/* The size rung is woven into the pill rather than layered over it, so the
   declarations come out in one fixed order at either size. */
function pill(size) {
  const rung = SIZES[size] ?? SIZES.md;
  return {
    display: "inline-flex",
    alignItems: "center",
    position: "relative",
    height: rung.height,
    padding: rung.padding,
    borderRadius: "var(--radius-full)",
    fontFamily: "var(--font-sans)",
    fontSize: rung.fontSize,
    lineHeight: rung.lineHeight,
    letterSpacing: rung.letterSpacing,
    fontWeight: rung.fontWeight,
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
  };
}

/* THE READOUT TONE (jakob's ruling, the conformance round). A readout is a chip
   the reader is being SHOWN — the topics inside the acts card, where what a
   signature will carry is read back to its author — and it is not a control:
   no press, no state layer, no target, so no button and no `switch` role over
   something nothing can switch. It is the borderless `secondary-container`
   pill, 24px true, and it takes the `secondary-container` pair for the same
   reason `TopicRemovable` does: what is drawn there is a piece of the thing
   being authored, not a filter over somebody else's.

   IT HAS ONE RUNG, the small one. A readout that offered a size choice would be
   a control again; `size` belongs to the filter tone.

   The box is `min-height` and padding rather than the filter pill's fixed
   height, because a readout has to grow with the reader's text setting instead
   of clipping it — nothing here is a target that a growing box would move.
   `flex: none` is the acts row's business: that row's value slot clips, and a
   topic shrunk to nothing would be a lie about what is being signed. The
   letter-spacing is spelled `0.5px` rather than the token the way
   `InlineAction`'s small rung is — the same half-pixel at a 16px root, taken
   from the call site value for value. */
const READOUT = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  padding: "2px 8px",
  borderRadius: "var(--radius-full)",
  background: "var(--secondary-container)",
  color: "var(--on-secondary-container)",
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  fontWeight: "var(--text-label-small--font-weight)",
  letterSpacing: "0.5px",
  flex: "none",
};

export function Chip({ label, selected = false, onToggle, ariaLabel, disabled = false, size = "md", tone = "filter" }) {
  if (tone === "readout") return <span style={READOUT}>{label}</span>;
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
        ...pill(size),
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
    ...pill(size),
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
