"use client";

// The reference chip (D16, design.md §6): one standing or drafted
// reference, rendered deliberately plain — jakob is designing the
// body-integrated render, so this hits the redesign once rather than
// twice.
//
// One visual serves every target class, which is the point: quoting,
// embedding and mentioning are ONE record and the target's class is the
// whole distinction (D2). A profile target reads as `@handle` — that is
// a MENTION — a topic as `#name`, a post or comment as its author and a
// snippet.
//
// Two shapes share the visual, exactly as the topic chip's do: a chip
// that NAVIGATES to the target's existing route, and a DRAFT chip whose
// label is instead the button opening its parameter sliders. The two
// controls are SIBLINGS inside one wrapper, never nested — a link inside
// a button is invalid HTML and unreachable by keyboard.
//
// A target CoGra carries no display row for has no route to offer, so
// its chip renders off the raw identifier and navigates nowhere.

import Link from "next/link";

import type { ReferenceTargetView } from "@/lib/references/draft";

export function ReferenceChip({
  target,
  pending = false,
  onRemove,
  removeLabel,
  onSelect,
  selectLabel,
  expanded,
  testId,
}: {
  target: ReferenceTargetView;
  /** Some record in the bundle is still in flight (`ReferenceClaim.pending`). */
  pending?: boolean;
  /** Present only for a removable chip. */
  onRemove?: () => void;
  removeLabel?: string;
  /** Makes the label a button — a draft chip opening its sliders. */
  onSelect?: () => void;
  selectLabel?: string;
  /** Whether `onSelect`'s panel is open, for the label's `aria-expanded`. */
  expanded?: boolean;
  testId?: string;
}) {
  const label = target.label;
  // A draft chip adjusts rather than navigates, so `onSelect` wins over
  // the route the target would otherwise offer.
  const navigable = onSelect === undefined && target.href !== null;
  return (
    <span
      data-testid={testId}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary-container px-3 py-1 text-label-medium text-on-secondary-container"
    >
      {navigable ? (
        <Link
          href={target.href as string}
          data-testid={testId !== undefined ? `${testId}-link` : undefined}
          className="truncate"
        >
          {label}
        </Link>
      ) : onSelect !== undefined ? (
        <button
          type="button"
          aria-label={selectLabel ?? `Adjust the reference to ${label}`}
          aria-expanded={expanded}
          data-testid={testId !== undefined ? `${testId}-select` : undefined}
          onClick={onSelect}
          className="truncate text-on-secondary-container"
        >
          {label}
        </button>
      ) : (
        <span className="truncate">{label}</span>
      )}
      {pending && (
        <span
          aria-hidden="true"
          data-testid={testId !== undefined ? `${testId}-pending` : undefined}
          className="text-on-surface-variant"
        >
          …
        </span>
      )}
      {onRemove !== undefined && (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove the reference to ${label}`}
          data-testid={testId !== undefined ? `${testId}-remove` : undefined}
          onClick={onRemove}
          className="flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full text-on-secondary-container"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  );
}
