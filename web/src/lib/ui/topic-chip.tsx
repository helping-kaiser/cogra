"use client";

// The topic chip (design.md §6: "Topic chip — a tappable tag"). Ships
// deliberately plain — jakob is re-thinking the rest of slice 2's
// visual design, so this hits it once at the redesign rather than
// twice.
//
// Two shapes share one visual: a plain chip that navigates to the
// topic route (a chip on a post/comment card, or the composer's own
// draft once submitted), and a REMOVABLE chip that also carries an "x"
// (the composer's draft-before-send, or an own-content chip row's
// remove gesture, D14). The two controls are SIBLINGS inside one
// wrapper, never nested — a link inside a button (or vice versa) is
// invalid HTML and unreachable by keyboard in a browser's own way.

import Link from "next/link";

export function TopicChip({
  name,
  href,
  pending = false,
  onRemove,
  removeLabel,
  testId,
}: {
  /** The canonical name (hashtag.md §1) — displayed as `#name`. */
  name: string;
  /** Omit for a draft chip not yet backed by a route (composer). */
  href?: string;
  /** The winning record is still in flight (`TopicClaim.pending`). */
  pending?: boolean;
  /** Present only for a removable chip. */
  onRemove?: () => void;
  removeLabel?: string;
  testId?: string;
}) {
  const label = `#${name}`;
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1 text-label-medium text-on-secondary-container"
    >
      {href !== undefined ? (
        <Link href={href} data-testid={testId !== undefined ? `${testId}-link` : undefined}>
          {label}
        </Link>
      ) : (
        <span>{label}</span>
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
          aria-label={removeLabel ?? `Remove ${label}`}
          data-testid={testId !== undefined ? `${testId}-remove` : undefined}
          onClick={onRemove}
          className="flex min-h-6 min-w-6 items-center justify-center rounded-full text-on-secondary-container"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  );
}
