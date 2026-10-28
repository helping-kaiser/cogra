"use client";

// THE WORDED TRIGGER (design/components/navigation/FeedFilter.jsx
// `FilterTrigger`): the pill that reads the view back in words and opens the
// filter sheet — 32px, the field border, `label-large`, a single line held to
// 14rem and ellipsized past it. Search wears it beside its "?"; the feed and
// History will take the same master.
//
// ITS NAME IS THE READING, THEN THE PURPOSE (the K13 round; WCAG 2.5.3):
// `Everything, what the search shows`. A name that replaced the reading would
// hide the filter's state from exactly the reader who cannot see the pill.

import { testAttributes, type DataNode } from "@/lib/ui/data-node";

/** `triggerName` (FeedFilter.jsx): the reading, then the purpose lower-cased. */
export function triggerName(reading: string, purpose: string): string {
  if (purpose === "") return reading;
  return `${reading}, ${purpose.charAt(0).toLowerCase()}${purpose.slice(1)}`;
}

export function FilterTrigger({
  reading,
  purpose,
  onOpen,
  expanded = false,
  node,
  testId,
}: {
  reading: string;
  /** What the sheet is for — the second half of the name. */
  purpose: string;
  onOpen: () => void;
  expanded?: boolean;
  node?: DataNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={triggerName(reading, purpose)}
      onClick={onOpen}
      {...testAttributes(node, testId)}
      className="cg-state cg-focus cg-hit relative box-border inline-flex h-8 max-w-56 min-w-0 cursor-pointer items-center overflow-hidden rounded-full border border-solid border-outline bg-transparent px-3 font-sans text-label-large text-ellipsis whitespace-nowrap text-on-surface"
    >
      {/* The ellipsis needs a block to clip; the button's own overflow is the
          state layer's box. */}
      <span className="min-w-0 overflow-hidden text-ellipsis">{reading}</span>
    </button>
  );
}
