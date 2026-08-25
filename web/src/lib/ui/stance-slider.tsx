"use client";

import { useId } from "react";

import { formatDimension } from "@/lib/ui/stance-format";

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
      <label htmlFor={id} className="text-label-large">
        {label} {formatDimension(value)}
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
