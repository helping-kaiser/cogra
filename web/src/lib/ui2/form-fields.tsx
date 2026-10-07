"use client";

// THE TASK PAGES' FIELDS (design/components/forms/TextField.jsx and
// PasswordField.jsx): a `label-large` label over a field on the extra-small
// corner, and ONE supporting slot under it — the hint at rest, the error in
// its place when refused, taking the outline and the label with it. The line
// is wired to the field (`aria-describedby`; `aria-invalid` and
// `role="alert"` in the error state).
//
// WHAT A FIELD ASKS OF THE KEYBOARD comes from its kind (the K13 field-kind
// table, `FIELD_KINDS`): its type, input mode, capitalization, correction and
// what the platform may fill in. The return key follows the form — `next`
// while another field follows, `go` on the last.
//
// A credential form names its account by the email as `username`, in a hidden
// input where it draws no email field (`account`, PasswordField.jsx) — how a
// password manager learns whose password is being re-proved or changed.

import { useId, useState, type Ref } from "react";

import { BUTTON_CLASS } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";

/** TextField.jsx's `FIELD_KINDS`, the K13 field-semantics table. */
export const FIELD_KINDS = {
  email: {
    type: "email",
    inputMode: "email",
    autoCapitalize: "none",
    autoCorrect: "off",
    autoComplete: "email",
  },
  handle: {
    type: "text",
    inputMode: "text",
    autoCapitalize: "none",
    autoCorrect: "off",
    autoComplete: "nickname",
  },
  digits: {
    type: "text",
    inputMode: "numeric",
    autoCapitalize: "none",
    autoCorrect: "off",
    autoComplete: "one-time-code",
  },
} as const;

export type FieldKind = keyof typeof FIELD_KINDS;

const FIELD =
  "cg-focus box-border w-full min-w-0 rounded-extra-small border bg-transparent px-3 py-2 text-body-large text-on-surface";

function Support({
  id,
  hint,
  error,
  node,
}: {
  id: string;
  hint?: string;
  error?: string | null;
  node?: DataNode;
}) {
  const line = error ?? hint;
  if (line === undefined || line === null) return null;
  return (
    <span
      id={id}
      role={error ? "alert" : undefined}
      className={`text-body-small ${error ? "text-error" : "text-on-surface-variant"}`}
      {...testAttributes(node)}
    >
      {line}
    </span>
  );
}

export function FormTextField({
  label,
  value,
  onChange,
  kind,
  hint,
  error = null,
  mono = false,
  enterKeyHint = "next",
  node,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  kind: FieldKind;
  hint?: string;
  error?: string | null;
  mono?: boolean;
  enterKeyHint?: "next" | "go";
  node?: DataNode;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  const supportId = `${id}-support`;
  const semantics = FIELD_KINDS[kind];
  const described = error || hint ? supportId : undefined;
  return (
    <div className="flex flex-col gap-1" {...testAttributes(node)}>
      <label
        htmlFor={id}
        className={`text-label-large ${error ? "text-error" : ""}`}
        {...testAttributes(part(node, "label"))}
      >
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={semantics.type}
        inputMode={semantics.inputMode}
        autoCapitalize={semantics.autoCapitalize}
        autoCorrect={semantics.autoCorrect}
        autoComplete={semantics.autoComplete}
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD} ${error ? "border-error" : "border-outline"} ${mono ? "font-mono" : ""}`}
        {...testAttributes(part(node, "input"))}
      />
      <Support id={supportId} hint={hint} error={error} node={part(node, "support")} />
    </div>
  );
}

export function FormPasswordField({
  label,
  value,
  onChange,
  autoComplete,
  account,
  hint,
  error = null,
  enterKeyHint = "go",
  node,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: "current-password" | "new-password";
  /** The account's address, as the hidden `username` the form names. */
  account?: string;
  hint?: string;
  error?: string | null;
  enterKeyHint?: "next" | "go";
  node?: DataNode;
}) {
  const id = useId();
  const supportId = `${id}-support`;
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1" {...testAttributes(node)}>
      <label
        htmlFor={id}
        className={`text-label-large ${error ? "text-error" : ""}`}
        {...testAttributes(part(node, "label"))}
      >
        {label}
      </label>
      {account !== undefined && (
        <input
          type="email"
          autoComplete="username"
          value={account}
          readOnly
          hidden
          data-testid="hidden-username"
        />
      )}
      <div className="flex items-center gap-2">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={enterKeyHint}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? supportId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD} flex-1 ${error ? "border-error" : "border-outline"}`}
          {...testAttributes(part(node, "input"))}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((shown) => !shown)}
          className={`${BUTTON_CLASS} grid size-12 flex-none place-items-center rounded-full border-0 bg-transparent p-0 text-on-surface-variant`}
          {...testAttributes(part(node, "reveal"))}
        >
          <Icon name={visible ? "visibility_off" : "visibility"} />
        </button>
      </div>
      <Support id={supportId} hint={hint} error={error} node={part(node, "support")} />
    </div>
  );
}
