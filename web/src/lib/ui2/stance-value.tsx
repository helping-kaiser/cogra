// A PAIR, READ (design/components/stance/StanceReadout.jsx `StanceValue`): the
// face is the quick read and the digits carry the fact. The digits are the
// geek reading (readme §13, "One markup, two paintings") — a `cg-exact` span,
// painted only in exact mode — and the whole fact is the element's accessible
// name in both modes, so nothing spoken depends on the mode.

import { bundleReadout } from "@/lib/stance/anchors";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { SEVERED_LABEL } from "@/lib/ui/stance-readout";
import { formatStancePair } from "@/lib/ui/stance-format";

export function StanceValue({
  pDirected,
  pInterest,
  zeroLabel = SEVERED_LABEL,
  node,
  testId,
}: {
  pDirected: number;
  pInterest: number;
  /** What a (0, 0) speaks; the master's default is the walk-back's. */
  zeroLabel?: string;
  /** The registered pair (`feedEntry.carries.value`); its parts are `face` and `exact`. */
  node?: DataNode;
  testId?: string;
}) {
  const pair = { pDirected, pInterest };
  const readout = bundleReadout(pair, zeroLabel);
  return (
    <span
      role="img"
      aria-label={`${readout.label}, ${formatStancePair(pair)}`}
      className="inline-flex items-center gap-1.5"
      {...testAttributes(node, testId)}
    >
      <span aria-hidden="true" className="text-title-medium" {...testAttributes(part(node, "face"))}>
        {readout.emoji}
      </span>
      <span
        aria-hidden="true"
        className="cg-exact whitespace-nowrap text-body-small text-on-surface-variant"
        {...testAttributes(part(node, "exact"))}
      >
        {formatStancePair(pair)}
      </span>
    </span>
  );
}
