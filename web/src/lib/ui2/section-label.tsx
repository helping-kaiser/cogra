// A QUIET SECTION CAPTION (`design/components/core/SectionLabel.jsx`): the
// small secondary word that names a group on a sectioned surface — a search's
// `Profiles` and `Tags` over the cards they head.
//
// IT IS A CAPTION, NOT A HEADING: no heading level and no weight beyond
// `label-small`, because what it names is already visible under it. Its
// padding is asymmetric on purpose — 12 above, 4 below — so it sits with the
// group it opens, and it carries the screen gutter itself (24).

import type { ReactNode } from "react";

import { testAttributes, type DataNode } from "@/lib/ui/data-node";

export function SectionLabel({
  children,
  node,
  testId,
}: {
  children: ReactNode;
  /** The registered caption (`history.profilesLabel`). */
  node?: DataNode;
  testId?: string;
}) {
  return (
    <span
      {...testAttributes(node, testId)}
      className="block px-6 pb-1 pt-3 text-label-small text-on-surface-variant"
    >
      {children}
    </span>
  );
}
