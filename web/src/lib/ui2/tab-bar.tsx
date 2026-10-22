"use client";

// THE FULL-WIDTH TAB ROW (design/components/navigation/TabBar.jsx): equal cells
// across the surface with a hairline under them, the chosen one in `primary`
// with a 2px underline. The profile's chronicle draws it with glyphs.
//
// THE UNDERLINE IS THE MASTER'S DELIBERATE DEVIATION from "selection is colour
// only": three same-weight glyphs cannot be told apart by colour alone. It is
// an inset shadow, so choosing a tab never moves the row's height.
//
// A CELL'S KIND IS ITS CONTENT. A tab with an `icon` is a glyph cell named by
// its `label`; a tab without one shows the label as its words and takes no
// second name.
//
// A GROUP OF TOGGLES, NOT A TABLIST: nothing here controls a `tabpanel` — the
// row filters the list beneath it — so the cells are `aria-pressed` buttons in
// a labelled group.

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon, type GlyphName } from "@/lib/ui/icons";

export type Tab<Id extends string> = {
  readonly id: Id;
  readonly label: string;
  readonly icon?: GlyphName;
};

export function TabBar<Id extends string>({
  tabs,
  value,
  ariaLabel,
  onSelect,
  iconSize = 22,
  node,
  testId,
}: {
  tabs: readonly Tab<Id>[];
  value: Id;
  /** Names the choice being made, not the thing being filtered. */
  ariaLabel: string;
  onSelect: (id: Id) => void;
  iconSize?: number;
  /** The registered row (`profile.tabRow`); each cell is its `<id>Tab`. */
  node?: DataNode;
  testId: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      {...testAttributes(node, testId)}
      className="flex border-b border-solid border-outline-variant"
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={selected}
            aria-label={tab.icon !== undefined ? tab.label : undefined}
            onClick={() => onSelect(tab.id)}
            {...testAttributes(part(node, `${tab.id}Tab`), `${testId}-${tab.id}`)}
            className={`cg-state cg-focus grid min-h-12 flex-1 cursor-pointer place-items-center border-0 bg-transparent p-0 ${
              selected ? "text-primary shadow-[inset_0_-2px_0_var(--primary)]" : "text-on-surface-variant"
            } ${tab.icon !== undefined ? "" : "font-sans text-label-large"}`}
          >
            {tab.icon !== undefined ? <Icon name={tab.icon} size={iconSize} /> : tab.label}
          </button>
        );
      })}
    </div>
  );
}
