"use client";

// THE REFERENCE ROW (design/components/content/ReferenceRow.jsx): a node in a
// list of found things — the search's results first. A 32px mark saying the
// kind, the name on one line, the INDIRECT line under it when the row was
// found through something else (`on <title>`, `tagged by @sol`), and one right
// edge: the viewer-relative RANK beside the score's graph glyph, or a plain
// VALUE (an age), or nothing.
//
// THE MARK SAYS THE KIND WITHOUT A WORD: a person is their avatar — people are
// circles everywhere in this system — a post with a cover its cover, a text
// post the letter `T`, a comment its bubble, a tag the `#` its chip wears.
//
// THE RANK IS SEEN AS GLYPH + NUMBER AND HEARD AS THE NUMBER (the master's
// SR-only twin); the drawn pair is hidden from assistive tech.

import Link from "next/link";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { MonogramAvatar } from "./monogram-avatar";

export type ReferenceKind = "post" | "comment" | "person" | "topic";

const TILE =
  "grid size-8 flex-none place-items-center overflow-hidden rounded-small bg-surface-container-highest text-on-surface-variant";

function Mark({ kind, name, src, node }: { kind: ReferenceKind; name: string; src: string | null; node?: DataNode }) {
  if (kind === "person") return <MonogramAvatar name={name} src={src} size={32} node={node} />;
  if (kind === "post" && src !== null) {
    return (
      <span aria-hidden="true" className={TILE} {...testAttributes(node)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a 32px decorative tile, never a layout image */}
        <img src={src} alt="" className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`${TILE} text-title-medium`} {...testAttributes(node)}>
      {kind === "comment" ? <Icon name="chat_bubble" size={18} /> : kind === "topic" ? "#" : "T"}
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
  /** Where the row opens; null draws a row that opens nothing. */
  href: string | null;
  onOpen?: () => void;
  node?: DataNode;
  testId?: string;
}) {
  const inner = (
    <>
      <Mark kind={kind} name={name} src={src} node={part(node, "mark")} />
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
