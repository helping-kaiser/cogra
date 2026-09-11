import React from "react";
import { formatDimension, formatUnsigned } from "./StanceReadout.jsx";

/* One authored dimension as an ordinary range input: a float, step 0.01, with
   the two-decimal value in the label. Android's StanceSlider.

   For a STANCE this is the ACCESSIBLE path (design.md §8.6, §10) — the pad is a
   drag gesture, and a drag gesture always has a non-drag equivalent.

   FOR A TAG'S PAIR IT IS THE NON-DRAG EQUIVALENT (jakob's ruling, the tag pad
   round). A tag's pair is set on the pad, and the pad is a drag gesture, so
   §10's standing demand applies there exactly as it does to a stance: the
   equivalent has to exist and be reachable. Two labelled tracks are it, with
   the tag's own poles and its own bound.

   THE RANGE IS A PROP, AND THE FORMAT FOLLOWS IT. `min`/`max` default to the
   stance range; an axis with no negative half drops the sign from its readout
   for the reason `formatTagPair` gives — a `+` advertising a pole that does
   not exist. A caller states the bound, never a screen redrawing the control.

   THE POLES ARE NAMED. A track says nothing about what either end means, and
   the axis label alone was carrying too much: "Against" and "For" under the
   ends make the control readable at a glance instead of after a sentence.
   `body-small` on `onSurfaceVariant` so they inform without competing. */

export function StanceSlider({ label, value, onChange, minLabel, maxLabel, id, min = -1, max = 1 }) {
  const format = min < 0 ? formatDimension : formatUnsigned;
  const generated = React.useId();
  const fieldId = id ?? generated;
  return (
    // Same reasoning as TextField's own `data-field`: `type="range"` is a
    // replaced element too and cannot host the flow badge's ::after, so the
    // badge names the slider as a whole (jakob's ruling A9, backlog item 40).
    <div data-field={label} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <label
        htmlFor={fieldId}
        style={{
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          fontWeight: "var(--text-label-large--font-weight)",
        }}
      >
        {label} {format(value)}
      </label>
      <input
        id={fieldId}
        type="range"
        min={min}
        max={max}
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
