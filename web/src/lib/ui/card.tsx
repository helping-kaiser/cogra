import type { MouseEvent, ReactNode } from "react";

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
//
// `onOpen` MAKES THE CARD'S BARE GROUND A DOOR TOO, where a sidecar says a tap
// anywhere outside the card's own controls opens it (FeedKinds.md:27,
// ProfileComments.md:49). It is the "redundant click" of the documented
// card pattern (Heydon Pickering, *Inclusive Components*, "Cards"): the
// card's one accessible door stays its `cg-door` link, and a click that lands
// on the card's plain ground — its padding, its gaps, a line of text — is
// forwarded to the same destination. Nothing interactive is nested in
// anything else, so assistive technology still meets one link per door.
// A press on anything with its own meaning keeps it: a link, a control, a
// door region (which opens itself), an open dialog, or an element marked
// `data-own-press` (an inert chip that must stay inert). A click that ends a
// text selection selects, and opens nothing — the pattern's own guard.

/** What keeps its own press inside a card that is a door. */
const OWN_PRESS =
  "a, button, input, textarea, select, label, summary, dialog, [role=button], [role=link], [role=dialog], [role=menuitem], [contenteditable=true], .cg-door, [data-own-press]";

/**
 * Whether a click on a door card lands on its bare ground: inside the card's
 * own DOM (a portalled surface's click bubbles through React, not the DOM),
 * on nothing with a press of its own, and not the end of a text selection.
 */
export function pressIsOnCardGround(event: MouseEvent<HTMLElement>): boolean {
  const target = event.target;
  if (!(target instanceof Element) || !event.currentTarget.contains(target)) return false;
  if (target.closest(OWN_PRESS) !== null) return false;
  const selection = typeof window === "undefined" ? null : window.getSelection();
  return selection === null || selection.isCollapsed;
}

export function Card({
  children,
  testId,
  node,
  door = false,
  onOpen,
}: {
  children: ReactNode;
  testId?: string;
  /** The registered node this card is, which then names it instead of `testId`. */
  node?: DataNode;
  /** The card holds a `cg-door` region whose press lights the whole card. */
  door?: boolean;
  /** A click on the card's bare ground opens what its `cg-door` opens. */
  onOpen?: () => void;
}) {
  return (
    <section
      {...testAttributes(node, testId)}
      onClick={
        onOpen === undefined
          ? undefined
          : (event) => {
              if (pressIsOnCardGround(event)) onOpen();
            }
      }
      className={`${door ? "cg-door-card " : ""}${onOpen === undefined ? "" : "cursor-pointer "}flex flex-col gap-3 rounded-medium bg-surface-container-highest p-4`}
    >
      {children}
    </section>
  );
}
