// THE QUIET NOTE (design/components/core/QuietNote.jsx): one line in the
// smallest type the system has, telling the reader something true about the
// surface they stand on. It never asks for anything, carries no colour beyond
// the secondary ink, and no spacing of its own — the column it sits in owns
// the gap.

import type { ReactNode } from "react";

import { testAttributes, type DataNode } from "@/lib/ui/data-node";
import { nameInText } from "@/lib/ui/names";

export function QuietNote({
  children,
  node,
  testId,
}: {
  children: ReactNode;
  node?: DataNode;
  testId?: string;
}) {
  return (
    // TEXT THAT WRAPS (NamesLong.md:11): `… an opinion @… gave.` wraps at its
    // spaces and the handle is one unit (`nameInText`).
    <p className="m-0 text-label-small text-on-surface-variant [overflow-wrap:anywhere]" {...testAttributes(node, testId)}>
      {nameInText(children)}
    </p>
  );
}
