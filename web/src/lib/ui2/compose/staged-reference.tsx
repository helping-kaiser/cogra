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
// never three identically-named buttons. Given no `onEdit` the row is inert
// but for its × (the master's own rule) — the kept picks' review draws it so.
//
// THE PAIR READS FACE AND DIGITS: the face carries the feel, the digits ride a
// `cg-exact` tail (readme §13), and a screen-reader twin says the exact pair.
// A citation is not a stance, so the anchor's word is withheld (K5.3) — UNLESS
// THE PAIR IS A STANCE IN ITS OWN RIGHT (`stance`, the kept picks' review): a
// kept pick's row speaks the pair as `StanceReadout` does, the anchor's word
// and both axes named.
//
// A KEPT PICK'S TWO ROW STATES (the master's `removed` and `consequence`,
// jakob 2026-10-02): a target removed while the pick waited wears the
// removed-mark face — the tile empty, the mark in the name's place in the
// system's voice — and its controls name it by the mark; a pick that would
// net its bundle to nothing says so under its kind, in the family's words.

import type { ReferenceTargetView } from "@/lib/references/draft";
import { bundleReadout, EMPTY_PICK_LABEL } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import { formatStancePair, formatStanceWords, STANCE_AXES, type StanceAxes } from "@/lib/ui/stance-format";
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

/** `NodeMark`'s kinds as a staged row draws them: a person is a circle, the rest tiles. */
export type StagedMarkKind = "post" | "comment" | "person" | "topic";

const TILE =
  "grid size-8 flex-none place-items-center overflow-hidden rounded-small bg-surface-container-high text-on-surface-variant";

function Mark({
  kind,
  name,
  src,
  removed,
  node,
}: {
  kind: StagedMarkKind;
  name: string;
  src?: string | null;
  removed: boolean;
  node?: DataNode;
}) {
  // A person is their face; a post or comment its 32px tile on the card tone;
  // a removed target keeps the tile's space and fills it with nothing.
  return (
    <span className="flex flex-none" {...testAttributes(part(node, "mark"))}>
      {kind === "person" ? (
        <MonogramAvatar name={name} src={src} redacted={removed} size={32} />
      ) : kind === "topic" ? (
        <span aria-hidden="true" className={`${TILE} text-title-medium`}>
          {removed ? null : "#"}
        </span>
      ) : (
        <NodeMark kind={kind} src={src} redacted={removed} />
      )}
    </span>
  );
}

export function StagedRow({
  kind,
  name,
  markName,
  sub,
  src,
  pair,
  stance = false,
  axes = STANCE_AXES,
  removed,
  consequence,
  onRemove,
  onEdit,
  expanded,
  node,
  testId,
}: {
  kind: StagedMarkKind;
  name: string;
  /** The name a person's monogram is drawn from, when it is not the row's name. */
  markName?: string;
  /** The second line — what the thing is. */
  sub?: string | null;
  src?: string | null;
  pair: StancePair;
  /** The pair is a stance in its own right: spoken as the readout speaks it. */
  stance?: boolean;
  /** The record family's words, for a stance's spoken pair. */
  axes?: StanceAxes;
  /** The target's removal mark, standing where the name stood. */
  removed?: string | null;
  /** A pick that would net its bundle to nothing says so under its kind. */
  consequence?: string | null;
  onRemove: () => void;
  /** Given, the row (minus the ×) opens the pair; without it the row is inert. */
  onEdit?: () => void;
  expanded?: boolean;
  node?: DataNode;
  testId?: string;
}) {
  const anchor = bundleReadout(pair, EMPTY_PICK_LABEL);
  const exact = formatStancePair(pair);
  const spoken = stance ? `${anchor.label}, ${formatStanceWords(pair, axes)}` : exact;
  const mark = removed ? `${sub ? `${sub}, ` : ""}${removed}` : name;
  const removeLabel = removed ? `Remove this ${stance ? "pick" : "citation"}: ${mark}` : `Remove ${name}`;
  const body = (
    <>
      <Mark kind={kind} name={markName ?? name} src={src} removed={Boolean(removed)} node={node} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={`truncate text-body-medium${removed ? " font-normal text-on-surface-variant" : ""}`}
          {...testAttributes(part(node, "name"), testId === undefined ? undefined : `${testId}-name`)}
        >
          {removed || name}
        </span>
        {sub && (
          <span className="text-body-small text-on-surface-variant" {...testAttributes(part(node, "kind"))}>
            {sub}
          </span>
        )}
        {consequence && (
          <span
            className="text-body-small text-on-surface-variant"
            {...testAttributes(
              part(node, "consequence"),
              testId === undefined ? undefined : `${testId}-consequence`,
            )}
          >
            {consequence}
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
      <span className="sr-only">{spoken}</span>
    </>
  );
  return (
    <div
      {...testAttributes(node, testId)}
      className="box-border flex min-h-12 items-center gap-2 rounded-small bg-surface-container-highest px-3 py-2"
    >
      {onEdit ? (
        <button
          type="button"
          aria-label={`${mark} — set how it relates`}
          aria-expanded={expanded}
          onClick={onEdit}
          data-testid={testId === undefined ? undefined : `${testId}-select`}
          className="cg-state cg-focus cg-hit flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-small border-0 bg-transparent p-0 text-left text-inherit [font:inherit]"
        >
          {body}
        </button>
      ) : (
        body
      )}
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        {...testAttributes(part(node, "remove"), testId === undefined ? undefined : `${testId}-remove`)}
        className="cg-state cg-focus grid size-8 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-on-surface-variant"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

/** A staged citation: `StagedRow` over the reference's own view of its target. */
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
  return (
    <StagedRow
      kind={target.kind === "User" ? "person" : target.kind === "Comment" ? "comment" : "post"}
      name={target.label}
      markName={target.kind === "User" ? (target.displayName ?? target.handle ?? target.label) : undefined}
      sub={referenceKindWord(target)}
      pair={{ pDirected: relevance, pInterest: support }}
      onRemove={onRemove}
      onEdit={onEdit}
      expanded={expanded}
      node={node}
      testId={testId}
    />
  );
}
