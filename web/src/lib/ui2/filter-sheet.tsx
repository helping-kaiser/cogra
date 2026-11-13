"use client";

// THE FILTER IDIOM'S PARTS (`design/components/navigation/FeedFilter.jsx`
// `FilterTrigger` and `FilterFoot`; `OrderSection.jsx` `FilterSection`): the
// worded trigger a list wears, the section chrome every filter sheet uses,
// and the Done row every filter sheet ends on. History is the first web
// surface to own a filter sheet; the feed's and search's will compose the
// same parts rather than draw their own.
//
// NO GLYPH ON THE TRIGGER: the product's inlined set has no filter icon and
// §5 forbids drawing one, so the trigger says its state in words.
//
// THE SHEET STAGES, AND `Done` COMMITS (the sheet law, readme §4, *Sheets*):
// these parts only draw — the host keeps the staged copy and decides what
// each way out does.

import type { ReactNode } from "react";

import { Button } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Checkbox } from "./checkbox";
import { SegmentedFilter } from "./segmented-filter";

/**
 * THE TRIGGER'S NAME IS THE READING, THEN THE PURPOSE (the K13 round; WCAG
 * 2.5.3): `Everything, what your history shows`. A name that replaced the
 * reading would hide the filter's state from the reader who cannot see it.
 */
export function triggerName(reading: string, purpose: string): string {
  if (purpose === "") return reading;
  return `${reading}, ${purpose.charAt(0).toLowerCase()}${purpose.slice(1)}`;
}

export function FilterTrigger({
  reading,
  purpose,
  expanded,
  onOpen,
  node,
  testId,
}: {
  /** The pill's own words — the filter's state. */
  reading: string;
  /** What the sheet it opens is for (`What your history shows`). */
  purpose: string;
  expanded: boolean;
  onOpen: () => void;
  node?: DataNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-label={triggerName(reading, purpose)}
      onClick={onOpen}
      {...testAttributes(node, testId)}
      // label-large whole inside the 32px pill (FeedFilter.jsx, round 28).
      className="cg-state cg-focus cg-hit relative inline-flex h-8 min-w-0 max-w-56 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-outline bg-transparent px-3 text-label-large text-on-surface"
    >
      {reading}
    </button>
  );
}

/** A filter sheet's section: its label, an optional hint, then its controls. */
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
  // THE SECTION CARRIES THE 24px GUTTER ITSELF (`FilterSection`'s `0 24px
  // 16px`): it stands in a sheet of rows, edge to edge, beside the foot that
  // carries its own. Its label is label-large whole (OrderSection.jsx, round 28).
  return (
    <div {...testAttributes(node)} role="group" aria-label={label} className="flex flex-col gap-2 px-6 pb-4">
      <span
        {...testAttributes(part(node, "label"))}
        className="text-label-large"
      >
        {label}
      </span>
      {hint !== undefined && (
        <span {...testAttributes(part(node, "hint"))} className="text-body-small text-on-surface-variant">
          {hint}
        </span>
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * The Done row: a hairline, `Reset` in the corner, the commit at the end. It
 * carries NO READING of the staged filter — the sections above are the staged
 * filter, already in view. `Reset` stages, `Done` commits.
 */
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
        {...testAttributes(node, testId)}
        className="flex items-center gap-2 border-t border-outline-variant pt-2.5"
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

/** The seen toggle's words (copy-voice.md, the filter's order section). */
export const SHOW_WHAT_YOU_VE_SEEN = "Show what you've already seen";

/**
 * THE ONE ORDER SECTION (`OrderSection.jsx`, ruled identical on the feed and
 * on search, backlog item 19): Ranked or Newest — the one choice that does not
 * combine — with the seen toggle under it, both answering "how is this list
 * arranged". It carries no hint: the Ranked / Newest explainer lives in the
 * sheet's "?" (copy-voice, *The filter*; jakob 2026-11-12).
 */
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
    <FilterSection label="Order" node={node}>
      <SegmentedFilter ariaLabel="Order" options={options} value={order} onChange={onOrder} node={part(node, "picker")} />
      {seen !== undefined && onSeen !== undefined && (
        <div className="basis-full">
          <Checkbox label={SHOW_WHAT_YOU_VE_SEEN} checked={seen} onChange={onSeen} node={part(node, "seen")} />
        </div>
      )}
    </FilterSection>
  );
}
