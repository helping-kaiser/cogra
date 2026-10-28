"use client";

// THE REFERENCE ROW (design/components/content/ReferenceRow.jsx): a node in a
// list of found things — the search's results, and what cites a node. A 32px
// mark saying the kind, the name on one line, the INDIRECT line under it when
// the row was found through something else (`on <title>`, `tagged by @sol`),
// and one right edge: the viewer-relative RANK beside the score's graph glyph,
// the signed PAIR of the act the row is about, or a plain VALUE (an age), or
// nothing.
//
// THE MARK SAYS THE KIND WITHOUT A WORD: a person is their avatar — people are
// circles everywhere in this system — a post with a cover its cover, a text
// post the letter `T`, a comment its bubble, a tag the `#` its chip wears.
//
// THE RANK IS SEEN AS GLYPH + NUMBER AND HEARD AS THE NUMBER (the master's
// SR-only twin); the drawn pair is hidden from assistive tech.

import Link from "next/link";

import { bundleReadout } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { NodeMark } from "@/lib/ui/node-mark";
import { PendingMarker } from "@/lib/ui/pending-marker";
import { formatStancePair } from "@/lib/ui/stance-format";
import { SEVERED_LABEL } from "@/lib/ui/stance-readout";
import { MonogramAvatar } from "./monogram-avatar";

export type ReferenceKind = "post" | "comment" | "person" | "topic";

function Mark({
  kind,
  name,
  src,
  redacted,
  node,
}: {
  kind: ReferenceKind;
  name: string;
  src: string | null;
  redacted: boolean;
  node?: DataNode;
}) {
  if (kind === "person") return <MonogramAvatar name={name} src={src} size={32} redacted={redacted} node={node} />;
  // A result list stands off any card, so the tile keeps its own tone (`onCard`).
  return <NodeMark kind={kind} src={src} redacted={redacted} onCard={false} node={node} />;
}

/**
 * THE SIGNED PAIR ON THE ROW'S EDGE (`ReferenceRow.jsx`): the nearest anchor's
 * glyph through the choke point, the digits in a `cg-exact` span that paints
 * only in geek mode, and an SR-only twin so nothing spoken depends on the mode.
 * A citation's anchor WORD is withheld — a stance anchor names a feeling about
 * a stance, which a citation is not — so its twin is the pair itself.
 *
 * A SETTLING ACT SAYS SO UNDER THE PAIR, not under the name: what has not
 * landed is the act, not the node it points at.
 */
function PairValue({ pair, pending, node }: { pair: StancePair; pending: boolean; node?: DataNode }) {
  const anchor = bundleReadout(pair, SEVERED_LABEL);
  const exact = formatStancePair(pair);
  return (
    <span
      className="flex flex-none flex-col items-end text-body-small whitespace-nowrap text-on-surface-variant"
      {...testAttributes(node)}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="text-[length:var(--text-body-medium)] [line-height:1]" {...testAttributes(part(node, "face"))}>
          {anchor.emoji}
        </span>
        <span className="cg-exact" {...testAttributes(part(node, "exact"))}>
          {exact}
        </span>
      </span>
      <span className="sr-only">{exact}</span>
      {pending && <PendingMarker inline testId={node === undefined ? "pending" : `${node.path}.pending`} />}
    </span>
  );
}

export function ReferenceRow({
  kind,
  name,
  sub = null,
  src = null,
  rank = null,
  value = null,
  pair = null,
  pending = false,
  redacted = false,
  href,
  onOpen,
  node,
  testId,
}: {
  kind: ReferenceKind;
  name: string;
  sub?: string | null;
  src?: string | null;
  rank?: string | null;
  value?: string | null;
  /** The signed pair on the edge, as numbers the row formats (a citation's). */
  pair?: StancePair | null;
  /** The act is still settling: the marker stacks under the pair. */
  pending?: boolean;
  /** The thing the row names was removed: its mark keeps its space and fills with nothing. */
  redacted?: boolean;
  /** Where the row opens; null draws a row that opens nothing. */
  href: string | null;
  onOpen?: () => void;
  node?: DataNode;
  testId?: string;
}) {
  const inner = (
    <>
      <Mark kind={kind} name={name} src={src} redacted={redacted} node={part(node, "mark")} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className="min-w-0 overflow-hidden text-body-medium text-ellipsis whitespace-nowrap"
          {...testAttributes(part(node, "name"))}
        >
          {name}
        </span>
        {sub !== null && (
          <span
            className="min-w-0 overflow-hidden text-body-small text-ellipsis whitespace-nowrap text-on-surface-variant"
            {...testAttributes(part(node, "sub"))}
          >
            {sub}
          </span>
        )}
      </span>
      {rank !== null ? (
        <>
          <span
            aria-hidden="true"
            className="inline-flex flex-none items-center gap-1 text-body-small whitespace-nowrap text-on-surface-variant"
            {...testAttributes(part(node, "rank"))}
          >
            <Icon name="graph" size={14} />
            <span>{rank}</span>
          </span>
          <span className="sr-only">{rank}</span>
        </>
      ) : pair !== null ? (
        <PairValue pair={pair} pending={pending} node={part(node, "value")} />
      ) : (
        value !== null && (
          <span
            className="flex flex-none flex-col items-end text-body-small whitespace-nowrap text-on-surface-variant"
            {...testAttributes(part(node, "value"))}
          >
            {value}
          </span>
        )
      )}
    </>
  );
  const className =
    "cg-state cg-focus box-border flex min-h-12 w-full items-center gap-3 border-0 bg-transparent px-6 py-1 text-left font-sans text-on-surface no-underline";
  if (href === null) {
    return (
      <div className={className} {...testAttributes(node, testId)}>
        {inner}
      </div>
    );
  }
  return (
    <Link href={href} onClick={onOpen} className={className} {...testAttributes(node, testId)}>
      {inner}
    </Link>
  );
}
