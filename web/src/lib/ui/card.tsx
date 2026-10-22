import type { ReactNode } from "react";

import { testAttributes, type DataNode } from "./data-node";

// Material's filled card, the same surface Compose's `Card(...)` gives Android:
// `surfaceContainerHighest` against the page's `surface`, medium shape, no
// border and no shadow. The step up off the page ground is what makes a card
// read as a card (design.md §2.4); an outline on top of it would be Material's
// *outlined* card, a different component.
//
// `door` makes the whole card the pressed layer (`Card.jsx`; readme §4,
// *Interaction states*): the card carries `cg-door-card`, and a region inside
// it carrying `cg-door` — the words and the media that open the post — lights
// the card's whole surface while it is hovered or pressed. A control inside the
// card (the stance face, the ⋮, a count) keeps its own layer and never lights
// the card.
export function Card({
  children,
  testId,
  node,
  door = false,
}: {
  children: ReactNode;
  testId?: string;
  /** The registered node this card is, which then names it instead of `testId`. */
  node?: DataNode;
  /** The card holds a `cg-door` region whose press lights the whole card. */
  door?: boolean;
}) {
  return (
    <section
      {...testAttributes(node, testId)}
      className={`${door ? "cg-door-card " : ""}flex flex-col gap-3 rounded-medium bg-surface-container-highest p-4`}
    >
      {children}
    </section>
  );
}
