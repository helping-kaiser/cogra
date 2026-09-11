import React from "react";

/* A quiet section caption (item 17, the conformance round): the small
   secondary word that names a group on a sectioned surface — the references
   sheet's groups, Explore's recents.

   IT IS A CAPTION, NOT A HEADING. It carries no heading level and no weight of
   its own beyond `label-small`: what it names is already visible underneath
   it, and the label's whole job is to be findable while scanning past. A
   surface whose sections need real headings has outgrown this.

   ITS PADDING IS ASYMMETRIC ON PURPOSE — 12 above, 4 below — so the label sits
   with the group it opens rather than floating between two of them. It carries
   the screen gutter itself, because it is placed in the scroll column beside
   full-bleed rows that carry their own.

   A NEAR-TWIN LIVES ON THE MONEY SPEC BOARD and is deliberately not this one:
   that board's label differs in padding, and a spec board's job is to draw a
   specimen, not to consume the system. */

export function SectionLabel({ children }) {
  return (
    <span
      style={{
        display: "block",
        padding: "12px 24px 4px",
        fontSize: "var(--text-label-small)",
        lineHeight: "var(--text-label-small--line-height)",
        fontWeight: "var(--text-label-small--font-weight)",
        letterSpacing: "var(--text-label-small--letter-spacing, 0.5px)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}
