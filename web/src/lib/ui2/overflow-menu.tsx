"use client";

// The overflow menu on a piece of content
// (design/components/content/OverflowMenu.jsx).
//
// EVERY post and every comment carries one. Genesis content always declares a
// license (post.md §1), so there is always at least the license entry — and a
// trigger that comes and goes between cards is worse than one that is always in
// the same place. It exists because the affordance row has a budget and the
// things competing for it do not all deserve the same weight: a stance is the
// gesture the product lives on, while checking a license is something a reader
// does once in a hundred readings.
//
// THE SHEET IS THE PRESENTATION, not an anchored popover. Both clients render
// at phone width and follow one design, so a menu pinned to a 24px glyph — a
// desktop idiom thumbs miss — is not what this draws.
//
// NOTHING IN HERE TAKES `error` COLOURING. A destructive item is drawn like the
// rest; the confirmation it opens is where the weight belongs.

import { useState, type ReactNode } from "react";

import { Icon } from "@/lib/ui/icons";
import { BottomSheet, SheetItem } from "./bottom-sheet";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  /** Distinguishes the row in tests; the label is still what a reader reads. */
  testId: string;
};

/**
 * The ⋮ and the sheet it opens.
 *
 * The trigger is `more_vert` in the card's header beside the timestamp — never
 * in the affordance row, which is for the things a reader actually reaches for.
 * It draws a 24px glyph inside the full 48px target, pulled back by -12px so it
 * keeps the 24px line it rides on, which is what a card header and a page
 * header's action are.
 */
export function OverflowMenu({
  items,
  ariaLabel,
  testId,
  trailing,
  stacked = false,
}: {
  items: readonly MenuItem[];
  /** What the trigger and the sheet are both called, e.g. "More on this post". */
  ariaLabel: string;
  testId: string;
  /** The dialogs and sheets the rows open, mounted beside the menu. */
  trailing?: ReactNode;
  /**
   * This menu opens over another sheet rather than over the page — the
   * comment's ⋮ over the comments thread (`CommentMenu.jsx`, design/readme.md:2364).
   * A menu whose presenter is the plain page (a post's own ⋮, a feed card's)
   * stays unstacked.
   */
  stacked?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // A menu with no rows is no menu. It cannot happen on genesis content, which
  // always declares a license — but a redacted record has no license left, and
  // a trigger that opens an empty sheet teaches the reader the card lies.
  if (items.length === 0) return trailing ?? null;

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid={testId}
        onClick={() => setOpen(true)}
        className="cg-state cg-focus -m-3 flex size-12 flex-none items-center justify-center rounded-full text-on-surface-variant"
      >
        <Icon name="more_vert" size={24} />
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={ariaLabel}
        titleHidden
        testId={`${testId}-sheet`}
        stacked={stacked}
      >
        <div className="flex flex-col">
          {items.map((item) => (
            <SheetItem
              key={item.label}
              testId={item.testId}
              onSelect={() => {
                // The sheet is the door, not the destination: it drops as the
                // row acts, so a dialog or sheet the row opens is not opening
                // behind a menu the reader has finished with.
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </SheetItem>
          ))}
        </div>
      </BottomSheet>
      {trailing}
    </>
  );
}
