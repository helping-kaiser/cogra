"use client";

// A labeled password input with a show/hide toggle (Android's
// PasswordTextField; the toggle's test id derives as `${testId}_toggle`).

import { useState } from "react";

import { buttonClassName } from "./button";

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
      <label htmlFor={id} className="text-label-large">
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
          className="min-w-0 flex-1 rounded-extra-small border border-outline bg-transparent px-3 py-2"
        />
        {/* Android puts this in the field's trailing-icon slot, where it is a
            transparent IconButton; text is the matching variant until the icon
            set arrives (§5). */}
        <button
          type="button"
          data-testid={`${testId}_toggle`}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
