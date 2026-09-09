"use client";

// The house labeled text input (the block every form repeated).
// join-view's error-bordered variant keeps its local input — the only
// consumer with per-field error styling.
//
// THE ERROR STATE IS THE FIELD'S OWN ANATOMY, as the canvas draws it
// (design/components/forms/TextField.jsx): the outline and the label
// switch to `--error` and a `body-small` supporting line carries the
// message verbatim, in words, with no icon. The line is wired to the
// control — it names an id the input points at through
// `aria-describedby`, the control adds `aria-invalid` (WCAG technique
// ARIA21), and the line takes `role="alert"`, because a message that
// appears in answer to something the reader just did has to announce
// itself: a screen reader that has moved on never comes back to look.

import { useId } from "react";

export function TextField({
  label,
  value,
  onChange,
  testId,
  type = "text",
  autoComplete,
  mono = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  mono?: boolean;
  error?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={`text-label-large${error ? " text-error" : ""}`}>
        {label}
      </label>
      <input
        id={id}
        data-testid={testId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-extra-small border bg-transparent px-3 py-2 ${
          error ? "border-error" : "border-outline"
        }${mono ? " font-mono" : ""}`}
      />
      {error && (
        <span id={errorId} role="alert" className="text-body-small text-error">
          {error}
        </span>
      )}
    </div>
  );
}
