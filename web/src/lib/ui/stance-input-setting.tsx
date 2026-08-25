"use client";

// Where design.md §8.6 puts the choice: settings offer the same value
// through paired sliders or direct entry, and picking one replaces the
// pad everywhere rather than per-screen. Radios, because it is one choice
// out of three — the semantics carry the arrow-key behaviour and the
// group name for free.

import { useId } from "react";

import {
  useStanceInputMode,
  STANCE_INPUT_MODES,
  type StanceInputMode,
} from "@/lib/stance/input-mode";
import { Card } from "@/lib/ui/card";

const COPY: Record<StanceInputMode, { label: string; hint: string }> = {
  pad: { label: "The pad", hint: "Press and hold, then drift to where you stand." },
  sliders: { label: "Sliders", hint: "One slider per side of the stance." },
  entry: { label: "Typed values", hint: "Type both numbers exactly." },
};

export function StanceInputSetting() {
  const [mode, setMode] = useStanceInputMode();
  const group = useId();
  return (
    <Card testId="settings_stance_input_card">
      <h2 className="text-title-medium">Taking a stance</h2>
      <p className="text-body-medium text-on-surface-variant">
        A tap always adds a small positive one. This is what a longer press opens, everywhere.
      </p>
      <div role="radiogroup" aria-label="Taking a stance" className="flex flex-col gap-2">
        {STANCE_INPUT_MODES.map((option) => (
          <label key={option} className="flex items-start gap-3 text-body-medium">
            <input
              type="radio"
              name={group}
              value={option}
              checked={mode === option}
              onChange={() => setMode(option)}
              data-testid={`settings_stance_input_${option}`}
              className="mt-1 accent-primary"
            />
            <span className="flex flex-col">
              <span className="text-label-large">{COPY[option].label}</span>
              <span className="text-body-small text-on-surface-variant">{COPY[option].hint}</span>
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}
