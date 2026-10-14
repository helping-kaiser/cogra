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
  testId,
}: {
  count: number;
  onOpen: () => void;
  /** The slow line or the count line, standing under the count. */
  subline?: string | null;
  testId: string;
}) {
  const line = actsFooterLine(count);
  const foot =
    count === 0 ? (
      <span
        data-testid={testId}
        className="flex items-center justify-center text-label-small text-on-surface-variant"
      >
        {line}
      </span>
    ) : (
      <button
        type="button"
        data-testid={testId}
        onClick={onOpen}
        className="cg-state cg-focus cg-hit flex items-center justify-center gap-1 border-0 bg-transparent p-0 text-label-small text-on-surface-variant"
      >
        {line}
        <ChevronGlyph />
      </button>
    );
  return (
    <div className="flex flex-col gap-0.5">
      {foot}
      {subline !== null && (
        <span
          role="status"
          data-testid={`${testId}-subline`}
          className="text-center text-label-small text-tertiary"
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
}: {
  name: string;
  onUndo: () => void;
  testId: string;
}) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-1 text-body-small text-on-surface-variant">
      <span data-testid={testId}>Withdrawn: {name}</span>
      <span aria-label={`Undo withdrawing ${name}`} className="inline-flex">
        <TextAction testId={`${testId}-undo`} onClick={onUndo}>
          Undo
        </TextAction>
      </span>
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
