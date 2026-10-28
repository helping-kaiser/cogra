// THE QUIET SECTION CAPTION (design/components/core/SectionLabel.jsx):
// `label-small` in the secondary colour, 12 above and 4 below so it sits with
// the group it opens, carrying the 24px screen gutter itself. A caption, not a
// heading — what it names is already visible under it — so it takes no
// heading level. Explore's `Recent` and `Profiles` wear it.

import type { ReactNode } from "react";

import { testAttributes, type DataNode } from "@/lib/ui/data-node";

export function SectionLabel({
  children,
  node,
  testId,
}: {
  children: ReactNode;
  node?: DataNode;
  testId?: string;
}) {
  return (
    <span
      className="block px-6 pt-3 pb-1 text-label-small text-on-surface-variant"
      {...testAttributes(node, testId)}
    >
      {children}
    </span>
  );
}
