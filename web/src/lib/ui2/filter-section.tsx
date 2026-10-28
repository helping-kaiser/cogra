"use client";

// THE FILTER SHEET'S SHARED PIECES (design/components/navigation/OrderSection.jsx,
// FeedFilter.jsx `FilterFoot`): one section chrome, the one Order section the
// feed's and search's sheets share (backlog item 19, ruled identical), and the
// one foot every filter sheet ends with. Search is their first consumer on the
// web; the feed's sheet and History's take the same three.
//
// ONE SECTION CHROME: a label at `label-large` (its role weighs 500), an optional hint in the
// secondary colour, then the controls, wrapping, `--space-2` apart. Each
// section carries the sheet's 24px gutter itself, the master's own padding.
//
// THE FOOT: `Reset` in its corner, a quiet text button, and `Done` at its end
// — over a hairline, and never a reading of what is staged (ExploreFilter.md:21-23).

import type { ReactNode } from "react";

import { Button } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Checkbox } from "./checkbox";
import { SegmentedFilter } from "./segmented-filter";

export function FilterSection({
  label,
  hint,
  children,
  node,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  node?: DataNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-6 pb-4" {...testAttributes(node)}>
      {/* The master sets the label's size and weight and leaves its leading to
          the sheet it stands on (OrderSection.jsx `FilterSection`): the
          sheet's body leading, 24px, not the label role's 20. */}
      <span
        className="text-label-large"
        style={{ lineHeight: "var(--text-body-large--line-height)" }}
        {...testAttributes(part(node, "label"))}
      >
        {label}
      </span>
      {hint !== undefined && (
        <span className="text-body-small text-on-surface-variant" {...testAttributes(part(node, "hint"))}>
          {hint}
        </span>
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** OrderSection.jsx's hint, verbatim. */
export const ORDER_HINT =
  "Ranked puts what's closest to you first — your view, no one else's. Newest ignores it and lists by time.";

/** The seen toggle's words (copy-voice.md, the filter's order section). */
export const SHOW_WHAT_YOU_VE_SEEN = "Show what you've already seen";

export function OrderSection<T extends string>({
  options,
  order,
  onOrder,
  seen,
  onSeen,
  node,
}: {
  options: readonly { value: T; label: string }[];
  order: T;
  onOrder: (next: T) => void;
  /** The seen toggle; omitted where it cannot stand (a guest's search, ExploreFilter.md:41). */
  seen?: boolean;
  onSeen?: (next: boolean) => void;
  node?: DataNode;
}) {
  return (
    <FilterSection label="Order" hint={ORDER_HINT} node={node}>
      <SegmentedFilter ariaLabel="Order" options={options} value={order} onChange={onOrder} node={part(node, "picker")} />
      {seen !== undefined && onSeen !== undefined && (
        <div className="basis-full">
          <Checkbox label={SHOW_WHAT_YOU_VE_SEEN} checked={seen} onChange={onSeen} node={part(node, "seen")} />
        </div>
      )}
    </FilterSection>
  );
}

export function FilterFoot({
  onReset,
  onDone,
  node,
  testId = "filter-foot",
}: {
  onReset: () => void;
  onDone: () => void;
  node?: DataNode;
  testId?: string;
}) {
  return (
    <div className="px-6">
      <div
        className="flex items-center gap-2 border-t border-solid border-outline-variant pt-2.5"
        {...testAttributes(node, testId)}
      >
        <Button testId={`${testId}-reset`} node={part(node, "reset")} variant="text" onClick={onReset}>
          Reset
        </Button>
        <span className="flex-1" />
        <Button testId={`${testId}-done`} node={part(node, "done")} onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
