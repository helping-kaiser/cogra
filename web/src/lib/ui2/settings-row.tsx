"use client";

// THE SETTINGS ROW AND ITS GROUP (design/components/core/SettingsRow.jsx).
//
// THE GROUP IS THE UNIT: a quiet heading, a filled card of rows, and a
// footnote under the card that says once what the group owes the reader. A
// `bare` group drops the card for a control that draws its own container.
// Rows are divided by a hairline inset to the row's own padding, never after
// the last.
//
// THE TRAILING EDGE IS THE VARIANT: a SWITCH (the whole row is the switch), a
// VALUE and a chevron (a choice made somewhere else), a chevron alone (a row
// that only goes somewhere), or a NODE of its own on an `inert` row (the
// sessions, whose word at the end is the target). A row may also be a CHOICE,
// a real radio with the drawn dot. An `action` row puts its label on
// `primary` and drops the chevron — never `error`, leaving is not a failure.
//
// The parts wear the registered `settings.*` paths when a node is handed in
// (`data-node.ts`): the row is the node, its words `label` / `status`, its
// trailing `value` / `switch` / `chevron`, a choice's dot `choice`.

import { Children, Fragment, type ReactNode, type Ref } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";

import { QuietNote } from "./quiet-note";

/**
 * The house switch, 44×24 with an 18px knob: off is the field's outline and
 * an outline knob at the left, on is `primary` with an `on-primary` knob at
 * the right — the knob travels, so the state is never colour alone.
 * Decorative here: the row that holds it is the `role="switch"` target.
 */
export function Switch({ checked, node }: { checked: boolean; node?: DataNode }) {
  return (
    <span
      aria-hidden="true"
      {...testAttributes(node)}
      className={`relative box-border h-6 w-11 flex-none rounded-full ${
        checked ? "bg-primary" : "border border-outline"
      }`}
    >
      <span
        className={`absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full ${
          checked ? "right-[3px] bg-on-primary" : "left-[2px] bg-outline"
        }`}
      />
    </span>
  );
}

/** The choice dot — ComposeLicense's radio, to the pixel. */
function ChoiceDot({ selected, node }: { selected: boolean; node?: DataNode }) {
  return (
    <span
      aria-hidden="true"
      {...testAttributes(node)}
      className={`box-border size-[18px] flex-none rounded-full ${
        selected ? "border-[5px] border-primary" : "border border-outline"
      }`}
    />
  );
}

const ROW =
  "relative box-border flex min-h-14 w-full items-center gap-4 border-0 bg-transparent px-4 py-2 text-left font-sans text-on-surface";

export type SettingsRowProps = {
  label: string;
  /** The second line: status, not description — except on a switch. */
  status?: string;
  /**
   * `error` says the status in the failure voice — a read-side comfort that
   * did not go through, in the hold's row vehicle (copy-voice *Faults by
   * code*).
   */
  statusTone?: "quiet" | "error";
  /** The current answer, in the reader's own words, before the chevron. */
  value?: string;
  /** A node of the row's own (the sessions' Revoke); makes the row `inert`. */
  trailing?: ReactNode;
  /** A switch row: the whole row toggles. */
  checked?: boolean;
  /** A choice row: one radio of a named group. */
  selected?: boolean;
  name?: string;
  action?: boolean;
  /** Overrides the chevron the variant implies. */
  chevron?: boolean;
  inert?: boolean;
  onOpen?: () => void;
  /** The row's own accessible description, where a busy word needs one. */
  busy?: boolean;
  node?: DataNode;
  rowRef?: Ref<HTMLElement>;
};

export function SettingsRow({
  label,
  status,
  statusTone = "quiet",
  value,
  trailing,
  checked,
  selected,
  name,
  action = false,
  chevron,
  inert = false,
  onOpen,
  busy = false,
  node,
  rowRef,
}: SettingsRowProps) {
  const isSwitch = checked !== undefined;
  const isChoice = selected !== undefined;
  const showChevron =
    chevron ?? (!isSwitch && !isChoice && !action && trailing === undefined && !inert);

  const words = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span
        className={`text-label-large ${action ? "text-primary" : ""}`}
        {...testAttributes(part(node, "label"))}
      >
        {label}
      </span>
      {status !== undefined && (
        <span
          role={statusTone === "error" ? "alert" : undefined}
          className={`truncate text-body-small ${
            statusTone === "error" ? "text-error" : "text-on-surface-variant"
          }`}
          {...testAttributes(part(node, "status"))}
        >
          {status}
        </span>
      )}
    </span>
  );
  const tail = (
    <>
      {value !== undefined && (
        <span
          className="flex-none text-body-medium text-on-surface-variant"
          {...testAttributes(part(node, "value"))}
        >
          {value}
        </span>
      )}
      {trailing}
      {isSwitch && <Switch checked={checked} node={part(node, "switch")} />}
      {showChevron && (
        <span
          aria-hidden="true"
          className="inline-flex flex-none text-on-surface-variant"
          {...testAttributes(part(node, "chevron"))}
        >
          <Icon name="chevron_right" size={18} />
        </span>
      )}
    </>
  );

  if (isChoice) {
    // The input carries the semantics and the group; the label carries the
    // words and the target (Checkbox.jsx, the license sheet).
    return (
      <label
        ref={rowRef as Ref<HTMLLabelElement>}
        className={`${ROW} cg-state cg-focus cursor-pointer`}
        {...testAttributes(node)}
      >
        <input
          type="radio"
          name={name}
          checked={selected}
          onChange={() => onOpen?.()}
          className="absolute m-0 size-px opacity-0"
        />
        <ChoiceDot selected={selected} node={part(node, "choice")} />
        {words}
      </label>
    );
  }

  if (isSwitch) {
    return (
      <button
        ref={rowRef as Ref<HTMLButtonElement>}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onOpen}
        className={`${ROW} cg-state cg-focus cursor-pointer`}
        {...testAttributes(node)}
      >
        {words}
        {tail}
      </button>
    );
  }

  if (inert) {
    return (
      // Programmatically focusable when the page moves focus onto it (a
      // revoked session hands focus to its neighbour), never a tab stop.
      <div
        ref={rowRef as Ref<HTMLDivElement>}
        tabIndex={rowRef === undefined ? undefined : -1}
        className={`${ROW} outline-none`}
        {...testAttributes(node)}
      >
        {words}
        {tail}
      </div>
    );
  }

  return (
    <button
      ref={rowRef as Ref<HTMLButtonElement>}
      type="button"
      onClick={busy ? undefined : onOpen}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      className={`${ROW} cg-state cg-focus cursor-pointer`}
      {...testAttributes(node)}
    >
      {words}
      {tail}
    </button>
  );
}

export function SettingsGroup({
  label,
  footnote,
  ariaLabel,
  bare = false,
  children,
  node,
  footnoteTestId,
}: {
  label?: string;
  footnote?: ReactNode;
  /** An unlabelled group's accessible name. */
  ariaLabel?: string;
  bare?: boolean;
  children: ReactNode;
  node?: DataNode;
  footnoteTestId?: string;
}) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <section
      aria-label={label === undefined ? ariaLabel : undefined}
      className="flex flex-col"
      {...testAttributes(node)}
    >
      {label !== undefined && (
        <h2
          className="mb-2 px-4 text-title-small text-on-surface-variant"
          {...testAttributes(part(node, "label"))}
        >
          {label}
        </h2>
      )}
      <div
        className={
          bare
            ? "flex flex-col"
            : "flex flex-col overflow-hidden rounded-medium bg-surface-container-highest text-on-surface"
        }
      >
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 && <div aria-hidden="true" className="ml-4 h-px bg-outline-variant" />}
            {row}
          </Fragment>
        ))}
      </div>
      {footnote !== undefined && (
        <div className="px-4 pt-2" {...testAttributes(part(node, "footnote"), footnoteTestId)}>
          <QuietNote>{footnote}</QuietNote>
        </div>
      )}
    </section>
  );
}
