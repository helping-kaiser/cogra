import React from "react";
import { formatDimension } from "./StanceReadout.jsx";

/* One stance dimension as an ordinary range input: a float in the closed [-1, +1],
   step 0.01, with the two-decimal value in the label. Android's StanceSlider.

   This is part of the ACCESSIBLE path (design.md §8.6, §10) — the pad is a drag
   gesture, and a drag gesture always has a non-drag equivalent.

   THE POLES ARE NAMED. A track running from −1 to +1 says nothing about what
   either end means, and the axis label alone was carrying too much: "Against" and
   "For" under the ends make the control readable at a glance instead of after a
   sentence. `body-small` on `onSurfaceVariant` so they inform without competing. */

export function StanceSlider({ label, value, onChange, minLabel, maxLabel, id }) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <label
        htmlFor={fieldId}
        style={{
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          fontWeight: "var(--text-label-large--font-weight)",
        }}
      >
        {label} {formatDimension(value)}
      </label>
      <input
        id={fieldId}
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange && onChange(Number(event.target.value))}
        style={{ width: "100%", accentColor: "var(--primary)" }}
      />
      {(minLabel || maxLabel) && (
        <div
          aria-hidden="true"
          style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}
        >
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
