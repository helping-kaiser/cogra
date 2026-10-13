"use client";

// THE HOUSE CHECKBOX (design/components/forms/Checkbox.jsx): an 18px box on the
// extra-small rung with the system's one hairline weight; checked fills
// `primary` with the inlined `check` glyph — colour plus a mark, never colour
// alone. THE ROW IS THE CONTROL: the label is part of the target, and the row
// reaches the 48px minimum however small the box is drawn. The real input
// carries the semantics and the focus; the drawn box is decoration.
//
// Parts wear the master's names when a node is handed in: the label row is
// the node, its `box` and its `label` the parts.

import { useId } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";

export function Checkbox({
  label,
  checked,
  onChange,
  node,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  node?: DataNode;
  testId?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="cg-state cg-focus relative flex min-h-12 cursor-pointer items-center gap-3 rounded-small"
      {...testAttributes(node, testId)}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="absolute m-0 size-px opacity-0"
      />
      <span
        aria-hidden="true"
        className={`box-border flex size-[18px] flex-none items-center justify-center rounded-extra-small text-on-primary ${
          checked ? "border border-transparent bg-primary" : "border border-outline"
        }`}
        {...testAttributes(part(node, "box"))}
      >
        {checked && <Icon name="check" size={14} />}
      </span>
      <span className="text-body-medium" {...testAttributes(part(node, "label"))}>
        {label}
      </span>
    </label>
  );
}
