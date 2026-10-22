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

import { testAttributes, type DataNode } from "./data-node";

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
  node,
  removeNode,
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
  /** Names the chip, and is what its controls' own ids derive from. */
  testId?: string;
  /** The registered node the chip is; it then names the chip instead of `testId`. */
  node?: DataNode;
  /** The registered node the remove control is, likewise. */
  removeNode?: DataNode;
}) {
  const label = `#${name}`;
  if (capped) {
    // THE CARD LINE'S PILL (`Chip.jsx` `TopicChip`, the `md` rung): 32px of
    // content in a hairline border — 34 drawn, as the boards and
    // PostDetail.md measure it — on the card's own surface, `label-large` in
    // the body ink, one line. It answers at 48px through `cg-hit`. A detail's
    // line is ONE control, so there the pill is inert (`href` absent): a link
    // nested in a button is two controls fighting over one press.
    const pill =
      "relative inline-flex h-8 box-content flex-none items-center whitespace-nowrap rounded-full border border-outline-variant bg-surface-container-highest px-3 text-label-large text-on-surface";
    return (
      <span {...testAttributes(node, testId)} className="inline-flex flex-none">
        {href !== undefined ? (
          <Link
            href={href}
            data-testid={testId !== undefined ? `${testId}-link` : undefined}
            className={`cg-state cg-focus cg-hit ${pill}`}
          >
            {label}
          </Link>
        ) : (
          <span className={pill}>{label}</span>
        )}
      </span>
    );
  }
  return (
    <span
      {...testAttributes(node, testId)}
      className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1 text-label-medium text-on-secondary-container"
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
          {...testAttributes(removeNode, testId !== undefined ? `${testId}-remove` : undefined)}
          onClick={onRemove}
          className="flex min-h-6 min-w-6 items-center justify-center rounded-full text-on-secondary-container"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  );
}
