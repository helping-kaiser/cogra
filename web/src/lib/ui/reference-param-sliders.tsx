"use client";

// The two parameters a Reference act carries (D1, D20): relevance and
// support, both bipolar over the census range with a centre-zero mark.
// Both open on the server's own defaults, so an untouched pair commits
// what omitting the fields would have — and because both defaults are
// strictly positive, an untouched MENTION vouches, weakly.
//
// Plain range inputs on purpose, exactly as the tag sliders are: the
// redesign hits this surface once, and a native slider is already the
// keyboard- and screen-reader-reachable control (design.md §10 — a drag
// always has a non-drag equivalent). The value rides the visible label,
// which is also the input's accessible name.

import { useId } from "react";

import {
  RELEVANCE_MAX,
  RELEVANCE_MIN,
  SUPPORT_MAX,
  SUPPORT_MIN,
} from "@/lib/references/draft";
import { formatDimension } from "@/lib/ui/stance-format";
import { RELEVANCE_LABEL, SUPPORT_LABEL } from "@/lib/ui/reference-format";

export function ReferenceParamSliders({
  relevance,
  support,
  onChange,
  testIdPrefix,
  forLabel,
}: {
  relevance: number;
  support: number;
  onChange: (next: { relevance: number; support: number }) => void;
  testIdPrefix: string;
  /** The reference these sliders edit, so each pair names itself. */
  forLabel?: string;
}) {
  const relevanceId = useId();
  const supportId = useId();
  const relevanceMarksId = useId();
  const supportMarksId = useId();
  const subject = forLabel === undefined ? "" : ` for ${forLabel}`;
  return (
    <div className="flex flex-col gap-2" data-testid={`${testIdPrefix}-params`}>
      <div className="flex flex-col gap-1">
        <label htmlFor={relevanceId} className="text-label-medium">
          {RELEVANCE_LABEL}
          {subject} {formatDimension(relevance)}
        </label>
        <input
          id={relevanceId}
          data-testid={`${testIdPrefix}-relevance`}
          type="range"
          list={relevanceMarksId}
          min={RELEVANCE_MIN}
          max={RELEVANCE_MAX}
          step={0.01}
          value={relevance}
          onChange={(event) => onChange({ relevance: Number(event.target.value), support })}
          className="w-full accent-primary"
        />
        {/* The centre-zero mark: zero is where the axis stops carrying,
            so the range says where that sits. */}
        <datalist id={relevanceMarksId}>
          <option value="0" />
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={supportId} className="text-label-medium">
          {SUPPORT_LABEL}
          {subject} {formatDimension(support)}
        </label>
        <input
          id={supportId}
          data-testid={`${testIdPrefix}-support`}
          type="range"
          list={supportMarksId}
          min={SUPPORT_MIN}
          max={SUPPORT_MAX}
          step={0.01}
          value={support}
          onChange={(event) => onChange({ relevance, support: Number(event.target.value) })}
          className="w-full accent-primary"
        />
        <datalist id={supportMarksId}>
          <option value="0" />
        </datalist>
      </div>
    </div>
  );
}
