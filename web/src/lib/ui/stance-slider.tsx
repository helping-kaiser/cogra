"use client";

import { useId } from "react";

/*
 * The two parameters, named the way a reader would name them. design.md
 * §7 keeps implementation vocabulary off the screen — "weight" and
 * "parameter" are on its list by name — and edges.md §1 leaves the
 * frontend free to surface whichever aspect fits the gesture. These are
 * §8.1's own descriptions, shortened to labels, and they are shared so
 * every surface that edits a stance says the same thing.
 */
export const DIRECTED_LABEL = "Where you stand";
export const INTEREST_LABEL = "How much you want to see";

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
