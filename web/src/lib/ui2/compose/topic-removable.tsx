"use client";

// A STAGED TAG, the composer's own pill (design/components/compose/
// TopicRemovable.jsx): `#name` and its ×, on the `secondary-container` pair
// that marks a piece of the thing being authored. The details stage and the
// seal's Tags sheet draw this one pill, because a sheet that drew its own
// version of a staged tag would be the second drawing of one fact.
//
// The name is a button opening the tag's pair (`<#name> — set how it
// relates`), and the × is named for what it removes (`Remove #name`): a pill
// of two controls, each with its own state layer and 48px target.

import { testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";

export function TopicRemovable({
  name,
  onRemove,
  onEdit,
  expanded,
  testId,
  node,
  removeNode,
}: {
  /** The canonical name, drawn as `#name`. */
  name: string;
  onRemove: () => void;
  /** Opens the tag's pair; absent, the name is plain words. */
  onEdit?: () => void;
  /** Whether what `onEdit` opens stands open, for the name's `aria-expanded`. */
  expanded?: boolean;
  testId?: string;
  node?: DataNode;
  removeNode?: DataNode;
}) {
  const label = `#${name}`;
  // A TAG IS ONE LINE (TopicRemovable.jsx `NAME`, round 63; jakob 2026-11-23:
  // "everywhere the tag is one-line at most"): the pill never grows past its
  // row and never wraps its name — a name too long for the row is the part
  // cut with "…", while the × keeps its room. A name that fits draws whole.
  // Both controls' accessible names carry the whole tag.
  const shown = <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>;
  return (
    <span
      {...testAttributes(node, testId)}
      className="inline-flex min-h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-label-large text-on-secondary-container"
    >
      {onEdit ? (
        <button
          type="button"
          aria-label={`${label} — set how it relates`}
          aria-expanded={expanded}
          data-testid={testId !== undefined ? `${testId}-select` : undefined}
          onClick={onEdit}
          className="cg-state cg-focus cg-hit inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent p-0 text-inherit [font:inherit] [letter-spacing:inherit]"
        >
          {shown}
        </button>
      ) : (
        shown
      )}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        {...testAttributes(removeNode, testId !== undefined ? `${testId}-remove` : undefined)}
        onClick={onRemove}
        className="cg-state cg-focus cg-hit inline-flex flex-none cursor-pointer rounded-full border-0 bg-transparent p-0 text-inherit"
      >
        <Icon name="close" size={16} />
      </button>
    </span>
  );
}
