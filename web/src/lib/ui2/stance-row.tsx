"use client";

// A PERSON ON AN OPINIONS LIST (design/components/people/StanceRow.jsx): their
// face, their name, and THE OPINION THE ROW IS ABOUT — the standing's own
// value, read-only. The value is the row's information; a list that showed
// only who would hide the part that says anything.
//
// THE WHOLE ROW OPENS THE PERSON. There is no adjust control here: acting on
// an opinion lives on the profile it is about. V1.0 passes no history door
// (the master's `onOpenHistory`, readme §13 F-1), so every row is the single
// element.
//
// WHICH (0, 0) THE ROW DRAWS IS THE ROW'S DATA (seam 245): a standing walked
// back speaks `Walked back`; one an empty sign left at nothing speaks `Says
// nothing`. The pair alone cannot tell them apart.

import Link from "next/link";

import { bundleReadout, EMPTY_PICK_LABEL } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { formatStancePair } from "@/lib/ui/stance-format";
import { SEVERED_LABEL } from "@/lib/ui/stance-readout";
import { MonogramAvatar } from "./monogram-avatar";

/**
 * The value as a readout (`StanceReadout.jsx` `StanceValue`): the face leads at
 * title-medium, the pair rides a `cg-exact` span that paints only in geek mode,
 * and the whole is ONE image whose name says both — the face's word and the
 * pair — in either mode, because nothing spoken may depend on a drawing
 * setting. The face goes through the choke point (`bundleReadout`), so 🤔 at
 * one zero and 🤷 at both are never a table face.
 */
export function StanceValue({
  pair,
  zeroLabel = SEVERED_LABEL,
  node,
  testId,
}: {
  pair: StancePair;
  zeroLabel?: string;
  node?: DataNode;
  testId?: string;
}) {
  const readout = bundleReadout(pair, zeroLabel);
  const exact = formatStancePair(pair);
  return (
    <span
      role="img"
      aria-label={`${readout.label}, ${exact}`}
      className="inline-flex flex-none items-center gap-1.5"
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
        {exact}
      </span>
    </span>
  );
}

export function StanceRow({
  name,
  handle,
  src = null,
  redacted = false,
  pair,
  severed = false,
  onOpen,
  node,
  testId,
}: {
  name: string;
  /** The handle line, and the profile the row opens; null draws a row that opens nothing. */
  handle: string | null;
  src?: string | null;
  /** A deleted account: the reserved disc. */
  redacted?: boolean;
  pair: StancePair;
  severed?: boolean;
  /** Fired as the row is followed — a sheet drops itself on the way out. */
  onOpen?: () => void;
  node?: DataNode;
  testId?: string;
}) {
  const inner = (
    <>
      <MonogramAvatar name={name} src={src} size={40} redacted={redacted} node={part(node, "avatar")} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-label-large" {...testAttributes(part(node, "name"))}>
          {name}
        </span>
        {handle !== null && (
          <span
            className="truncate text-label-small text-on-surface-variant"
            {...testAttributes(part(node, "handle"))}
          >
            @{handle}
          </span>
        )}
      </span>
      <StanceValue
        pair={pair}
        zeroLabel={severed ? SEVERED_LABEL : EMPTY_PICK_LABEL}
        node={part(node, "value")}
        testId={testId === undefined ? undefined : `${testId}-value`}
      />
    </>
  );
  const className =
    "cg-state cg-focus box-border flex min-h-14 w-full items-center gap-3 border-0 bg-transparent px-4 py-1.5 text-left font-sans text-on-surface no-underline";
  if (handle === null) {
    return (
      <div className={className} {...testAttributes(node, testId)}>
        {inner}
      </div>
    );
  }
  return (
    <Link href={`/u/${handle}`} onClick={onOpen} className={className} {...testAttributes(node, testId)}>
      {inner}
    </Link>
  );
}
