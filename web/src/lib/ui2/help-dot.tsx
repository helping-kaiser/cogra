"use client";

// The "?" affordance (design/components/core/HelpDot.jsx; readme §13):
// captions stay to one short line, and the full explanation lives behind a
// small "?" — at most one per screen, or one per sheet where a sheet is its
// own screen while it is open. The button IS the 48px target and the ring
// is drawn 32px inside it, as the master lays it out (`HelpDot.jsx`).
//
// `inverse` is the board's word for the same dot standing on a TONAL PANEL
// instead of the page: the ring takes the panel's own `currentColor` instead
// of the page's border/primary pair, which on the page would be a second
// colour family arguing with the panel's own (HelpDot.jsx:10-16).

import { testAttributes, type DataNode } from "@/lib/ui/data-node";

export function HelpDot({
  ariaLabel,
  onOpen,
  testId,
  variant = "page",
  node,
}: {
  ariaLabel: string;
  onOpen: () => void;
  testId?: string;
  variant?: "page" | "inverse";
  /** The registered node this dot is (`settings.licenseSheet.title.help`). */
  node?: DataNode;
}) {
  return (
    <button
      type="button"
      {...testAttributes(node, testId)}
      aria-label={ariaLabel}
      onClick={onOpen}
      className={`cg-state cg-focus grid size-12 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 ${
        variant === "inverse" ? "text-inherit" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 place-items-center rounded-full font-sans text-label-large ${
          variant === "inverse"
            ? "border border-current"
            : "border border-outline-variant text-primary"
        }`}
      >
        ?
      </span>
    </button>
  );
}
