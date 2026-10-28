"use client";

// THE PICKERS' SHARED ANATOMY (TagPicker.jsx: "`ReferencePicker`'s anatomy
// exactly — the same header, the same bar, the same rows, the same trailing
// add mark — because staging a tag and staging a citation are the same errand
// with a different record at the end").
//
// - `PickerRow` is a result row — `ReferenceRow`'s shape: the kind's mark,
//   the name over its second line, and the ADD MARK on its edge, since the
//   whole row's tap picks (`ReferenceRow`: "a picker's list only ever holds
//   rows still to add, each with the add mark on its edge").
// - `PickerStagedRow` is what a picked row becomes: `StagedReference` with no
//   pair and no edit door — the picker stages, the composer sets the pair —
//   standing above the results with its ×.
// - `PickerFrame` is the screen: the page header (arrow named for the
//   composer it returns to, the title, the one "?"), the fixed head (field,
//   the line under it, the staged section, the spoken status), the list, and
//   the full-width `Done` foot every wizard stage wears.
//
// THE MOVE IS SPOKEN (`PickAnnouncement`): a polite status region mounted
// with the screen, because assistive technology announces only changes to a
// region it was already watching; it draws nothing.

import type { ReactNode } from "react";

import { Icon } from "@/lib/ui/icons";
import { NodeMark } from "@/lib/ui/node-mark";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

import { HeaderBar } from "../header-bar";
import { HelpDot } from "../help-dot";
import { MonogramAvatar } from "../monogram-avatar";
import { PillButton } from "../pill-button";

/** What a picker row names: the four kinds the two pickers offer. */
export type PickerKind = "person" | "post" | "comment" | "topic";

function PickerMark({
  kind,
  name,
  src,
  onCard,
  node,
}: {
  kind: PickerKind;
  name: string;
  src?: string | null;
  onCard: boolean;
  node?: DataNode;
}) {
  return (
    <span className="flex flex-none" {...testAttributes(node)}>
      {kind === "person" ? (
        <MonogramAvatar name={name} src={src} size={32} />
      ) : (
        <NodeMark kind={kind} src={src} onCard={onCard} />
      )}
    </span>
  );
}

function RowText({ name, sub, node }: { name: string; sub?: string; node?: DataNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-body-medium" {...testAttributes(part(node, "name"))}>
        {name}
      </span>
      {sub !== undefined && (
        <span
          className="truncate text-body-small text-on-surface-variant"
          {...testAttributes(part(node, "sub"))}
        >
          {sub}
        </span>
      )}
    </span>
  );
}

/** A result row: tap to stage. */
export function PickerRow({
  kind,
  name,
  sub,
  src,
  onPick,
  disabled = false,
  node,
}: {
  kind: PickerKind;
  name: string;
  sub?: string;
  src?: string | null;
  onPick: () => void;
  /** At the composer's cap no further row can stage. */
  disabled?: boolean;
  node?: DataNode;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      {...testAttributes(node)}
      className="cg-state cg-focus flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-6 py-1 text-left text-on-surface [font:inherit] disabled:cursor-default disabled:opacity-[var(--state-disabled)]"
    >
      <PickerMark kind={kind} name={name} src={src} onCard={false} node={part(node, "mark")} />
      <RowText name={name} sub={sub} node={node} />
      <span aria-hidden="true" className="inline-flex flex-none text-on-surface-variant">
        <Icon name="add" size={20} />
      </span>
    </button>
  );
}

/** A staged row: what is held, and the × that un-stages it on the spot. */
export function PickerStagedRow({
  kind,
  name,
  sub,
  src,
  onRemove,
  node,
}: {
  kind: PickerKind;
  name: string;
  sub?: string;
  src?: string | null;
  onRemove: () => void;
  node?: DataNode;
}) {
  return (
    <div
      {...testAttributes(node)}
      className="box-border flex min-h-12 items-center gap-2 rounded-small bg-surface-container-highest px-3 py-2"
    >
      <PickerMark kind={kind} name={name} src={src} onCard node={part(node, "mark")} />
      <RowText name={name} sub={sub} node={node} />
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        {...testAttributes(part(node, "remove"))}
        className="cg-state cg-focus grid size-8 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-on-surface-variant"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

/** The arrow's name: the composer the picker returns to (the K13 round). */
export type PickerOrigin = "post" | "comment";

export function pickerBackLabel(origin: PickerOrigin): string {
  return origin === "post" ? "Back to the post" : "Back to the comment";
}

/**
 * The picker screen. `head` is the field and what stands under it; `staged`
 * the staged rows; `list` the results; `said` the status message's words.
 */
export function PickerFrame({
  title,
  origin,
  helpLabel,
  onHelp,
  onLeave,
  head,
  staged,
  said,
  list,
  footSpaced = false,
  node,
}: {
  title: string;
  origin: PickerOrigin;
  helpLabel: string;
  onHelp: () => void;
  /** Done and the header back: ONE LEAVE, every staged pick kept. */
  onLeave: () => void;
  head: ReactNode;
  staged: ReactNode;
  said: string;
  list: ReactNode;
  /**
   * The foot's 8px above `Done`: `ReferencePicker` draws it (`8px 24px
   * 24px`), the tag picker's footnote already ends its list (`0 24px 24px`).
   */
  footSpaced?: boolean;
  node: DataNode;
}) {
  return (
    <div {...testAttributes(node)} className="flex min-h-0 flex-1 flex-col">
      <HeaderBar
        title={title}
        onBack={onLeave}
        backLabel={pickerBackLabel(origin)}
        help={<HelpDot ariaLabel={helpLabel} onOpen={onHelp} node={part(part(node, "header"), "help")} />}
        node={part(node, "header")}
      />
      <div className="flex-none">
        {head}
        {staged}
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
          {...testAttributes(part(node, "announcement"))}
        >
          {said}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{list}</div>
      <div className={`flex-none px-6 pb-6 ${footSpaced ? "pt-2" : "pt-0"}`}>
        <PillButton testId={`${node.path}-done`} full onClick={onLeave} node={part(node, "done")}>
          Done
        </PillButton>
      </div>
    </div>
  );
}

/** The staged section: the picked rows between the field and the results. */
export function StagedSection({ children, node }: { children: ReactNode; node?: DataNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 pb-2" {...testAttributes(node)}>
      {children}
    </div>
  );
}
