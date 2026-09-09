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
//
// A draft chip navigates nowhere; instead its label is the button that
// opens the tag's own parameter sliders (F6), which is why `onSelect`
// and `href` are alternatives rather than companions.

import Link from "next/link";

export function TopicChip({
  name,
  href,
  onRemove,
  removeLabel,
  onSelect,
  selectLabel,
  expanded,
  capped = false,
  testId,
}: {
  /** The canonical name (hashtag.md §1) — displayed as `#name`. */
  name: string;
  /** Omit for a draft chip not yet backed by a route (composer). */
  href?: string;
  /** Present only for a removable chip. */
  onRemove?: () => void;
  removeLabel?: string;
  /** Makes the label a button — a draft chip opening its sliders (F6). */
  onSelect?: () => void;
  selectLabel?: string;
  /** Whether `onSelect`'s panel is open, for the label's `aria-expanded`. */
  expanded?: boolean;
  /**
   * The one-line form `TopicsLine` uses: the label on one line, the chip
   * sized to it. It carries NO width ceiling — a chip that cannot fit its
   * line is dropped from it rather than cut (jakob's ruling, 2026-09-09), so
   * the only thing this shape adds is the promise never to wrap or shrink.
   */
  capped?: boolean;
  testId?: string;
}) {
  const label = `#${name}`;
  return (
    <span
      data-testid={testId}
      className={
        capped
          ? "inline-block flex-none whitespace-nowrap rounded-full bg-secondary-container px-3 py-1 align-middle text-label-medium text-on-secondary-container"
          : "inline-flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1 text-label-medium text-on-secondary-container"
      }
    >
      {href !== undefined ? (
        <Link href={href} data-testid={testId !== undefined ? `${testId}-link` : undefined}>
          {label}
        </Link>
      ) : onSelect !== undefined ? (
        <button
          type="button"
          aria-label={selectLabel ?? `Adjust ${label}`}
          aria-expanded={expanded}
          data-testid={testId !== undefined ? `${testId}-select` : undefined}
          onClick={onSelect}
          className="text-on-secondary-container"
        >
          {label}
        </button>
      ) : (
        <span>{label}</span>
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
