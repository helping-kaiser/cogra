"use client";

// The house labeled text input (the block every form repeated).
// join-view's error-bordered variant keeps its local input — the only
// consumer with per-field error styling.

import { useId } from "react";

export function TextField({
  label,
  value,
  onChange,
  testId,
  type = "text",
  autoComplete,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        data-testid={testId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className={`rounded-md border border-outline bg-transparent px-3 py-2${
          mono ? " font-mono" : ""
        }`}
      />
    </div>
  );
}
