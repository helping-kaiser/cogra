// The 2.0 chip: one pill, told apart by what it does. A chip ACTS (the crop
// screen's three shapes, a topic being added); a topic chip NAVIGATES. Both are
// drawn at 32px and tapped at 48px.
//
// Selection is COLOUR ONLY — `secondaryContainer` filled against a 1px
// `outline` when unselected — and never a check glyph: a check appearing inside
// a selected chip reflows every label in the row as the reader picks, so the
// row moves under the thumb that is using it. Measurements are the canvas's
// (ComposeCrop's ratio row, ComposeDetails' topics row): 32px min height, 4px
// vertical and 12px horizontal padding, `label-large`.

import type { ReactNode } from "react";

export function Chip({
  children,
  testId,
  selected = false,
  disabled = false,
  // A chip that removes itself carries the dismiss glyph after its label.
  onDismiss,
  dismissLabel,
  onClick,
}: {
  children: ReactNode;
  testId: string;
  selected?: boolean;
  disabled?: boolean;
  onDismiss?: () => void;
  dismissLabel?: string;
  onClick?: () => void;
}) {
  const tone = selected
    ? "bg-secondary-container text-on-secondary-container"
    : "border border-outline text-on-surface-variant";

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        // A selectable chip is a toggle, so it reports its state rather than
        // relying on the colour change alone — colour never carries meaning
        // alone (design.md §10).
        aria-pressed={onClick ? selected : undefined}
        onClick={onClick}
        className={`cg-state cg-focus cg-hit box-border inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-label-large disabled:opacity-40 ${tone}`}
      >
        {children}
        {onDismiss && (
          // Rendered inside the chip but acting as its own control: a span with
          // a click handler would be unreachable by keyboard, and nesting a
          // second <button> inside one is invalid HTML. The dismiss sits after
          // the chip instead, absolutely placed over its trailing padding.
          <span aria-hidden="true" className="w-4" />
        )}
      </button>
      {onDismiss && (
        <button
          type="button"
          data-testid={`${testId}-dismiss`}
          aria-label={dismissLabel ?? "Remove"}
          disabled={disabled}
          onClick={onDismiss}
          className="cg-focus absolute top-1/2 right-2 -translate-y-1/2 disabled:opacity-40"
        >
          <DismissGlyph />
        </button>
      )}
    </span>
  );
}

// Material's `close`, 24px grid, filled cut — the same drawing the canvas puts
// on a picked topic and a picked photo. `currentColor` so it takes the chip's
// own ink.
export function DismissGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}
