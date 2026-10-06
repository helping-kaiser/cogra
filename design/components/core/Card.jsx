import React from "react";

/* Material's FILLED card (readme §4, *Corner radii and cards*): `surfaceContainerHighest` against the
   page's `surface`, the medium shape rung, 16px padding, 12px inner gap — no
   border and no shadow. The step up off the page ground is what makes a card read
   as a card; an outline on top of it would be Material's *outlined* card, a
   different component.

   `door` makes the whole card the pressed layer (the K13 round, readme §4,
   *Interaction states*): the card carries `cg-door-card`, and a region inside
   it carrying `cg-door` — the words and the media that open the post — lights
   the card's whole surface while it is hovered or pressed. A control inside the
   card (the stance face, the ⋮, a count) keeps its own layer and never lights
   the card. */

export function Card({ children, as = "section", ariaLabel, style, node, nodeKey, door = false }) {
  const Tag = as;
  return (
    <Tag
      aria-label={ariaLabel}
      className={door ? "cg-door-card" : undefined}
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
      data-node={node}
      data-node-key={nodeKey}
    >
      {children}
    </Tag>
  );
}
