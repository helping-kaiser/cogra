"use client";

import { useId } from "react";

/**
 * A stance dimension editor: a float in the closed [-1, +1]
 * (api-spec.md § Scalars), two-decimal label as the accessible name —
 * Android's StanceSlider.
 */
export function StanceSlider({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}: {value.toFixed(2)}
      </label>
      <input
        id={id}
        data-testid={testId}
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}
