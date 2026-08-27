import React from "react";

/* Material's FILLED card (design.md §2.4): `surfaceContainerHighest` against the
   page's `surface`, the medium shape rung, 16px padding, 12px inner gap — no
   border and no shadow. The step up off the page ground is what makes a card read
   as a card; an outline on top of it would be Material's *outlined* card, a
   different component. */

export function Card({ children, as = "section", ariaLabel, style }) {
  const Tag = as;
  return (
    <Tag
      aria-label={ariaLabel}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--card-gap)",
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-card)",
        color: "var(--on-surface)",
        padding: "var(--card-padding)",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
