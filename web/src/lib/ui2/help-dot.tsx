"use client";

// The "?" affordance (design/components/core/HelpDot.jsx; readme §13):
// captions stay to one short line, and the full explanation lives behind a
// small "?" — at most one per screen, or one per sheet where a sheet is its
// own screen while it is open. 32px drawn, 48px tapped via `cg-hit`, so a
// dense header or sheet title never loses the touch target to fit the ring.
//
// `inverse` is the board's word for the same dot standing on a TONAL PANEL
// instead of the page: the ring takes the panel's own `currentColor` instead
// of the page's border/primary pair, which on the page would be a second
// colour family arguing with the panel's own (HelpDot.jsx:10-16).

export function HelpDot({
  ariaLabel,
  onOpen,
  testId,
  variant = "page",
}: {
  ariaLabel: string;
  onOpen: () => void;
  testId?: string;
  variant?: "page" | "inverse";
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={onOpen}
      className={`cg-state cg-focus cg-hit relative flex size-8 flex-none items-center justify-center rounded-full text-label-large ${
        variant === "inverse"
          ? "border border-current text-inherit"
          : "border border-outline-variant text-primary"
      }`}
    >
      ?
    </button>
  );
}
