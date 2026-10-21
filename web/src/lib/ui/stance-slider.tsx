"use client";

import { useId } from "react";

import { formatDimension } from "@/lib/ui/stance-format";

/**
 * ONE AUTHORED DIMENSION AS AN ORDINARY RANGE INPUT
 * (`design/components/stance/StanceSlider.jsx`): a float in the closed
 * [-1, +1], step 0.01 — Android's StanceSlider. For a stance it is the
 * ACCESSIBLE path: the pad is a drag gesture, and a drag gesture always has a
 * non-drag equivalent.
 *
 * THE POLES ARE NAMED under the ends (`body-small` on `onSurfaceVariant`),
 * because a track from −1 to +1 says nothing about which end is which. THE
 * VALUE IN THE LABEL IS THE GEEK READING, in a `cg-exact` span (readme §13):
 * the range input announces its own value to a screen reader in both modes,
 * so nothing spoken is lost when the number is not painted.
 */
export function StanceSlider({
  label,
  value,
  onChange,
  minLabel,
  maxLabel,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** The pole at the track's low end — `Against`, `Less`. */
  minLabel?: string;
  /** The pole at the track's high end — `For`, `More`. */
  maxLabel?: string;
  testId: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label-large">
        {label} <span className="cg-exact">{formatDimension(value)}</span>
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
      {(minLabel !== undefined || maxLabel !== undefined) && (
        <div
          aria-hidden="true"
          data-testid={`${testId}-poles`}
          className="flex justify-between text-body-small text-on-surface-variant"
        >
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
