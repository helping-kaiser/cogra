"use client";

// THE SEAL'S ACTS CARD (design/components/compose/ActsCard.jsx): the
// container-highest card listing what one signature commits — one row per act
// kind (a quiet 76px label, the value, the bare count) and the total as its
// footer, with the all-or-nothing line under the total once the seal commits
// more than one act.
//
// THREE ROW SHAPES, one anatomy. A FACT row reads the act back; its value slot
// ends a long one in an ellipsis so the row holds one line. A DOOR row is a fact
// row whose fact is a collection (`N cited`, `N tags`): the whole row is the
// control, with no chevron and no trailing word, and its accessible name says
// what opens with the count folded in (`Manage the 3 citations`), because an
// `aria-label` replaces the box it names. A FAULT row is a fact row refused at
// signing: the refused-file line stands under its value, inside the row's own
// hairline, with `Remove it` as the only way out.
//
// THE COUNT IS SEEN BARE AND HEARD WHOLE: the digit leaves the accessibility
// tree and a paired reading says "3 citations", the noun coming from the row
// that knows what it staged, never from its label.

import type { ReactNode } from "react";

import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";

import { UploadErrorLine } from "./upload-notice";

/** label-small's size, leading and tracking at the ground's weight — the master sets no weight. */
const SMALL_GROUND =
  "text-[length:var(--text-label-small)]/[var(--text-label-small--line-height)] [letter-spacing:var(--text-label-small--letter-spacing)]";

export type ActsRow = {
  label: string;
  value: ReactNode;
  count: number;
  /** The singular noun the count counts; the card adds the regular plural. */
  countNoun: string;
  /** A door row: the whole row opens what the count counts. */
  open?: { label: string; onOpen: () => void };
  /** A refused act, said on its own row (`SealFaultRow`). */
  fault?: { message: string; onRemove: () => void; removeLabel?: string };
  testId?: string;
  /** The row's identity, where rows share a label (the kept picks' seal: one `Opinion` per pick). */
  key?: string;
};

/**
 * AN ACTION ROW (`ActsCard.jsx` `row.action`): what could still be added,
 * lined up with what has been — the reply seal's `+ Add a tag` and `+ Cite
 * something`. The whole row is the control, the master's small
 * `InlineAction` at the row's geometry, its count already words (`1 more`)
 * that say themselves. An action row has no value slot to clip.
 */
export type ActsAction = {
  action: string;
  /** The count slot's words, `1 more`. */
  count: string;
  onAct: () => void;
  testId?: string;
};

const ROW = "flex min-h-11 items-center gap-2";
const HAIRLINE = "border-0 border-b border-solid border-outline-variant";
const LABEL = "w-19 flex-none text-label-small text-on-surface-variant";
const VALUE = "min-w-0 flex-1 truncate text-body-medium";

function Count({ count, noun, node }: { count: number; noun: string; node?: DataNode }) {
  return (
    <span className={`flex-none ${SMALL_GROUND} text-on-surface-variant`} {...testAttributes(node)}>
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        {count} {count === 1 ? noun : `${noun}s`}
      </span>
    </span>
  );
}

/**
 * A row's test attributes where it shows them: its registered `actRow`
 * instance on a registered screen (which names it instead of `testId`), else
 * its own legacy id.
 */
function rowAttributes(row: ActsRow, node: DataNode | undefined, show: boolean) {
  if (!show) return {};
  return node === undefined ? { "data-testid": row.testId } : testAttributes(node);
}

function Row({ row, node }: { row: ActsRow; node?: DataNode }) {
  // The fault's line stands INSIDE the row's hairline, so a row carrying one
  // gives its hairline to the wrapper and keeps none of its own.
  const ruled = row.fault === undefined ? HAIRLINE : "";
  const slots = (
    <>
      <span className={LABEL} {...testAttributes(part(node, "label"))}>
        {row.label}
      </span>
      <span className={VALUE} {...testAttributes(part(node, "value"))}>
        {row.value}
      </span>
      <Count count={row.count} noun={row.countNoun} node={part(node, "count")} />
    </>
  );
  const line = row.open ? (
    <button
      type="button"
      {...rowAttributes(row, node, true)}
      onClick={row.open.onOpen}
      aria-label={row.open.label}
      className={`cg-state cg-focus ${ROW} ${ruled} w-full cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-on-surface`}
    >
      {slots}
    </button>
  ) : (
    <div {...rowAttributes(row, node, row.fault === undefined)} className={`${ROW} ${ruled}`}>
      {slots}
    </div>
  );
  if (row.fault === undefined) return line;
  return (
    <div {...rowAttributes(row, node, !row.open)} className={`${HAIRLINE} pb-2`}>
      {line}
      {/* Aligned with the value: the label's 76px and the row's 8px gap. */}
      <div className="pl-[calc(4.75rem+0.5rem)]">
        <UploadErrorLine
          message={row.fault.message}
          onRemove={row.fault.onRemove}
          removeLabel={row.fault.removeLabel}
          testId={row.testId === undefined ? undefined : `${row.testId}-fault`}
        />
      </div>
    </div>
  );
}

function ActionRow({ row, node }: { row: ActsAction; node?: DataNode }) {
  return (
    <button
      type="button"
      onClick={row.onAct}
      {...(node === undefined ? { "data-testid": row.testId } : testAttributes(node))}
      className={`cg-state cg-focus cg-hit ${ROW} ${HAIRLINE} w-full cursor-pointer bg-transparent p-0 text-left font-sans ${SMALL_GROUND} [font-weight:var(--text-label-small--font-weight)] text-primary`}
    >
      <span className={LABEL} {...testAttributes(part(node, "label"))} />
      <span className="min-w-0 flex-1 whitespace-nowrap" {...testAttributes(part(node, "action"))}>
        {row.action}
      </span>
      <span className={`flex-none ${SMALL_GROUND} text-on-surface-variant`} {...testAttributes(part(node, "count"))}>
        {row.count}
      </span>
    </button>
  );
}

function isAction(row: ActsRow | ActsAction): row is ActsAction {
  return "action" in row;
}

export function ActsCard({
  rows,
  total,
  note,
  noteTone = "quiet",
  testId,
  node,
}: {
  rows: readonly (ActsRow | ActsAction)[];
  total: string;
  /** The all-or-nothing line, or past 5s of signing the slow line. */
  note?: string | null;
  /** `slow`: the olive tertiary ink, announced once as a status. */
  noteTone?: "quiet" | "slow";
  testId?: string;
  /**
   * The registered card on a registered screen (`keptPicksSeal.acts`): each
   * row an `actRow` keyed by its place from 1 (its `label`, `value` and
   * `count`), then the card's `total` and `note`. It names them instead of
   * `testId`.
   */
  node?: DataNode;
}) {
  return (
    <div
      {...testAttributes(node, testId)}
      className="flex flex-col rounded-medium bg-surface-container-highest px-4 py-1"
    >
      {rows.map((row, index) =>
        isAction(row) ? (
          <ActionRow key={row.action} row={row} node={instance(node, "actRow", String(index + 1))} />
        ) : (
          <Row key={row.key ?? row.label} row={row} node={instance(node, "actRow", String(index + 1))} />
        ),
      )}
      {/* 48px of CONTENT plus 6px above and below, as the master's inline style
          measures it (content-box: 60px in all). */}
      <div className="box-content flex min-h-12 flex-col justify-center gap-0.5 py-1.5">
        <span
          {...testAttributes(part(node, "total"), testId === undefined ? undefined : `${testId}-total`)}
          className="text-body-medium [font-weight:var(--text-label-large--font-weight)]"
        >
          {total}
        </span>
        {note && (
          <span
            role={noteTone === "slow" ? "status" : undefined}
            {...testAttributes(part(node, "note"), testId === undefined ? undefined : `${testId}-note`)}
            className={`${SMALL_GROUND} ${noteTone === "slow" ? "text-tertiary" : "text-on-surface-variant"}`}
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

/** The total in the blessed words: `1 thing, signed`, `4 things, signed together`. */
export function actsTotal(count: number): string {
  return count === 1 ? "1 thing, signed" : `${count} things, signed together`;
}

/** The all-or-nothing line, carried only when the seal commits more than one act. */
export const ALL_OR_NOTHING = "They land together, or none does.";

/** The slow line (copy-voice, *Faults by code*), past 5s of signing. */
export const SLOW_SIGNING_LINE = "Still signing — the network is slow right now.";
