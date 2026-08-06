"use client";

// A labeled password input with a show/hide toggle (Android's
// PasswordTextField; the toggle's test id derives as `${testId}_toggle`).

import { useState } from "react";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  testId: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          data-testid={testId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        <button
          type="button"
          data-testid={`${testId}_toggle`}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className="rounded-md border border-zinc-300 px-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
