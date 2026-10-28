"use client";

// A STAGED CITATION, the composer's own row (design/components/compose/
// StagedReference.jsx): the kind's mark, the name over its kind, the pair the
// citation signs, and the remove ×. The details stage and the seal's Cited
// sheet draw this one row, because a citation staged anywhere is the same
// citation, and a second drawing of one fact drifts from the first.
//
// THE ROW OPENS THE PAIR (`onEdit`, jakob 2026-09-10) the way a staged tag's
// chip opens its own: the name is a button named `<name> — set how it
// relates`, and the × is named for what it removes, so a block of three is
// never three identically-named buttons.
//
// THE PAIR READS FACE AND DIGITS: the face carries the feel, the digits ride a
// `cg-exact` tail (readme §13), and a screen-reader twin says the exact pair.
// A citation is not a stance, so the anchor's word is withheld (K5.3).

import type { ReferenceTargetView } from "@/lib/references/draft";
import { bundleReadout, EMPTY_PICK_LABEL } from "@/lib/stance/anchors";
import { formatStancePair } from "@/lib/ui/stance-format";
import { NodeMark } from "@/lib/ui/node-mark";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";

import { MonogramAvatar } from "../monogram-avatar";

/** What class of thing is cited, as the master writes it ("Post", "Person"). */
export function referenceKindWord(target: ReferenceTargetView): string | null {
  switch (target.kind) {
    case "Post":
      return "Post";
    case "Comment":
      return "Comment";
    case "User":
      return "Person";
    default:
      return null;
  }
}

function Mark({ target, node }: { target: ReferenceTargetView; node?: DataNode }) {
  // A person is their face; a post or comment its 32px tile on the card tone,
  // a post wearing its cover where the lookup read one. The registered `mark`
  // is the tile itself — the face it draws — never a box around it.
  return target.kind === "User" ? (
    <MonogramAvatar
      name={target.displayName ?? target.handle ?? target.label}
      size={32}
      node={part(node, "mark")}
    />
  ) : (
    <NodeMark
      kind={target.kind === "Comment" ? "comment" : "post"}
      src={target.cover ?? null}
      node={part(node, "mark")}
    />
  );
}

export function StagedReference({
  target,
  relevance,
  support,
  onRemove,
  onEdit,
  expanded,
  node,
  testId,
}: {
  target: ReferenceTargetView;
  relevance: number;
  support: number;
  onRemove: () => void;
  onEdit: () => void;
  /** Whether what `onEdit` opens stands open, for the name's `aria-expanded`. */
  expanded?: boolean;
  /** `composeDetails.references.stagedReference` on the registered stage. */
  node?: DataNode;
  testId?: string;
}) {
  const pair = { pDirected: relevance, pInterest: support };
  const anchor = bundleReadout(pair, EMPTY_PICK_LABEL);
  const exact = formatStancePair(pair);
  const kind = referenceKindWord(target);
  return (
    <div
      {...testAttributes(node, testId)}
      className="box-border flex min-h-12 items-center gap-2 rounded-small bg-surface-container-highest px-3 py-2"
    >
      <button
        type="button"
        aria-label={`${target.label} — set how it relates`}
        aria-expanded={expanded}
        onClick={onEdit}
        data-testid={testId === undefined ? undefined : `${testId}-select`}
        className="cg-state cg-focus cg-hit flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-small border-0 bg-transparent p-0 text-left text-inherit [font:inherit]"
      >
        <Mark target={target} node={node} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-medium" {...testAttributes(part(node, "name"))}>
            {target.label}
          </span>
          {kind !== null && (
            <span className="text-body-small text-on-surface-variant" {...testAttributes(part(node, "kind"))}>
              {kind}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className="inline-flex flex-none items-center gap-1 whitespace-nowrap text-body-small text-on-surface-variant"
          {...testAttributes(part(node, "pair"))}
        >
          <span className="text-body-medium/none" {...testAttributes(part(part(node, "pair"), "face"))}>
            {anchor.emoji}
          </span>
          <span className="cg-exact" {...testAttributes(part(part(node, "pair"), "exact"))}>
            {exact}
          </span>
        </span>
        <span className="sr-only">{exact}</span>
      </button>
      <button
        type="button"
        aria-label={`Remove ${target.label}`}
        onClick={onRemove}
        {...testAttributes(part(node, "remove"), testId === undefined ? undefined : `${testId}-remove`)}
        className="cg-state cg-focus grid size-8 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-on-surface-variant"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
