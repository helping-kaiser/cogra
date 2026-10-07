"use client";

// THE SEGMENTED FILTER (design/components/navigation/SegmentedFilter.jsx): a
// 32px pill of one-word readings, one pressed. `block` stretches it to the
// column, each reading taking an equal share — Settings' Theme row.
//
// Each reading wears `<node>.<value>Option`, the registry's spelling.

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  block = false,
  node,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  block?: boolean;
  node?: DataNode;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      {...testAttributes(node)}
      className={`box-border h-8 max-w-full items-stretch overflow-hidden rounded-full border border-outline ${
        block ? "flex w-full" : "inline-flex w-fit"
      }`}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            {...testAttributes(part(node, `${option.value}Option`))}
            className={`cg-state cg-focus cg-hit relative flex min-w-0 flex-1 basis-0 items-center justify-center whitespace-nowrap border-0 px-4 font-sans text-label-large ${
              index === 0 ? "" : "border-l border-outline"
            } ${
              selected
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-transparent text-on-surface"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
