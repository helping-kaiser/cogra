// The edit family's foot and its detail (design/components/compose/
// ActsFooter.jsx, ActsCard.jsx; the EditActs and CommentEditActs boards).
//
// ONE FOOT FOR EVERY EDIT, because the guard is the family's
// (EditComposeUnchanged.md): `EditCompose`, `EditComposeVideo`, `EditWords`,
// `CommentEdit` and `CommentEditVideo` carry the same line over the same
// batch, so they carry the same zero.
//
// AT ZERO THE LINE STOPS BEING A BUTTON. `Nothing to sign yet` is a plain
// span: the acts sheet it would open has nothing in it, and a tap that can
// only open an empty list is a tap spent on nothing. The line still speaks —
// a foot gone silent would read as a fault.

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { PillButton, TextAction } from "@/lib/ui2/pill-button";
import {
  actsFooterLine,
  actsSheetTitle,
  editActCount,
  type EditActRow,
} from "@/lib/compose/edit-batch";

/** Shown under the count once the signing has gone 5s unanswered. */
export const EDIT_SLOW_LINE = "Still signing — the network is slow right now.";

/** Shown under the count when the prepared batch was not the one the foot read. */
export const EDIT_COUNT_CHANGED_LINE =
  "The count changed while you were editing — check it, then sign again.";

export function ActsFooter({
  count,
  onOpen,
  subline = null,
  sublineIsSlow = false,
  testId,
  node,
}: {
  count: number;
  onOpen: () => void;
  /** The slow line or the count line, standing under the count. */
  subline?: string | null;
  /** The subline is the slow line (the registered `slow`), not the count's. */
  sublineIsSlow?: boolean;
  testId: string;
  /**
   * The registered foot on a registered screen (`postEdit.acts`): the count's
   * `line` and the `slow` line. It names them instead of `testId`.
   */
  node?: DataNode;
}) {
  const line = actsFooterLine(count);
  const lineIds = testAttributes(part(node, "line"), testId);
  const foot =
    count === 0 ? (
      <span
        {...lineIds}
        className="flex items-center justify-center text-[length:var(--text-label-small)]/[var(--text-label-small--line-height)] [letter-spacing:var(--text-label-small--letter-spacing)] text-on-surface-variant"
      >
        {line}
      </span>
    ) : (
      <button
        type="button"
        {...lineIds}
        onClick={onOpen}
        className="cg-state cg-focus cg-hit flex items-center justify-center gap-1 border-0 bg-transparent p-0 text-[length:var(--text-label-small)]/[var(--text-label-small--line-height)] [letter-spacing:var(--text-label-small--letter-spacing)] text-on-surface-variant"
      >
        {line}
        <ChevronGlyph />
      </button>
    );
  return (
    <div className="flex flex-col gap-0.5" {...testAttributes(node)}>
      {foot}
      {subline !== null && (
        <span
          role="status"
          {...(sublineIsSlow && node !== undefined
            ? testAttributes(part(node, "slow"))
            : { "data-testid": `${testId}-subline` })}
          className="text-center text-[length:var(--text-label-small)]/[var(--text-label-small--line-height)] [letter-spacing:var(--text-label-small--letter-spacing)] text-tertiary"
        >
          {subline}
        </span>
      )}
    </div>
  );
}

/** The count seen bare and heard whole (`ActsCard.jsx`'s rule). */
function ActCount({ count, noun }: { count: number; noun: string }) {
  return (
    <span className="flex-none text-label-small text-on-surface-variant">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        {count} {count === 1 ? noun : `${noun}s`}
      </span>
    </span>
  );
}

/** `EditActs` / `CommentEditActs`: the batch, every kind, counted in records. */
export function ActsSheet({
  open,
  rows,
  onClose,
  testId,
}: {
  open: boolean;
  rows: readonly EditActRow[];
  onClose: () => void;
  testId: string;
}) {
  const count = editActCount(rows);
  return (
    <BottomSheet open={open} onClose={onClose} title={actsSheetTitle(count)} testId={testId}>
      <div className="flex flex-col gap-3 px-6 pb-4">
        <div
          aria-label="What the edit signs"
          className="flex flex-col rounded-medium bg-surface-container-highest px-4 py-1"
        >
          {rows.map((row) => (
            <div
              key={row.kind}
              data-testid={`${testId}-row-${row.kind}`}
              className="flex min-h-11 items-center gap-2 border-b border-outline-variant last:border-b-0"
            >
              <span className="w-28 flex-none text-label-small text-on-surface-variant">
                {row.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-body-medium">{row.value}</span>
              <ActCount count={row.count} noun={row.noun} />
            </div>
          ))}
          {rows.length > 1 && (
            <span
              data-testid={`${testId}-together`}
              className="py-2 text-label-small text-on-surface-variant"
            >
              They land together, or none does.
            </span>
          )}
        </div>
        <div className="flex justify-end">
          <PillButton variant="text" testId={`${testId}-done`} onClick={onClose}>
            Done
          </PillButton>
        </div>
      </div>
    </BottomSheet>
  );
}

/** `Withdrawn: #coastroad  Undo` — one line per withdrawn item, under its block. */
export function WithdrawnLine({
  name,
  onUndo,
  testId,
  node,
}: {
  name: string;
  onUndo: () => void;
  testId: string;
  /**
   * The registered line on a registered screen (`postEdit.tags.withdrawn`):
   * the line is the node and its `undo` a part. It names them instead of `testId`.
   */
  node?: DataNode;
}) {
  return (
    <p
      className="m-0 flex flex-wrap items-center gap-1 text-body-small text-on-surface-variant"
      {...testAttributes(node)}
    >
      <span data-testid={node === undefined ? testId : undefined}>Withdrawn: {name}</span>
      <TextAction
        testId={`${testId}-undo`}
        node={part(node, "undo")}
        ariaLabel={`Undo withdrawing ${name}`}
        onClick={onUndo}
      >
        Undo
      </TextAction>
    </p>
  );
}

// Material's `expand_more`, which is what the acts footer wears.
function ChevronGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
    </svg>
  );
}
