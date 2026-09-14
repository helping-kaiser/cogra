"use client";

// The "?" affordance (design/components/core/HelpDot.jsx; readme §13):
// captions stay to one short line, and the full explanation lives behind a
// small "?" — at most one per screen, or one per sheet where a sheet is its
// own screen while it is open. 32px drawn, 48px tapped via `cg-hit`, so a
// dense header or sheet title never loses the touch target to fit the ring.

export function HelpDot({
  ariaLabel,
  onOpen,
  testId,
}: {
  ariaLabel: string;
  onOpen: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={onOpen}
      className="cg-state cg-focus cg-hit relative flex size-8 flex-none items-center justify-center rounded-full border border-outline-variant text-label-large text-primary"
    >
      ?
    </button>
  );
}
