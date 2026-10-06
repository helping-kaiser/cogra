import type { ReactNode } from "react";

import { testAttributes, type DataNode } from "./data-node";

// Material's filled card, the same surface Compose's `Card(...)` gives Android:
// `surfaceContainerHighest` against the page's `surface`, medium shape, no
// border and no shadow. The step up off the page ground is what makes a card
// read as a card (design.md §2.4); an outline on top of it would be Material's
// *outlined* card, a different component.
export function Card({
  children,
  testId,
  node,
}: {
  children: ReactNode;
  testId?: string;
  /** The registered node this card is, which then names it instead of `testId`. */
  node?: DataNode;
}) {
  return (
    <section
      {...testAttributes(node, testId)}
      className="flex flex-col gap-3 rounded-medium bg-surface-container-highest p-4"
    >
      {children}
    </section>
  );
}
