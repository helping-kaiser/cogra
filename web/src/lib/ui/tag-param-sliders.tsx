"use client";

// The two parameters a Tag act carries (F6, ruling: sliders, not the
// pad): relevance over the bipolar census range with a centre-zero mark,
// confidence over `[0, 1]`. Both open on the server's own defaults, so
// an untouched pair commits what omitting the fields would have.
//
// Plain range inputs on purpose — the redesign hits this surface once,
// and a native slider is already the keyboard- and screen-reader-
// reachable control (design.md §10: a drag always has a non-drag
// equivalent). The value rides the visible label, which is also the
// input's accessible name.

import { useId } from "react";

import {
  CONFIDENCE_MAX,
  CONFIDENCE_MIN,
  RELEVANCE_MAX,
  RELEVANCE_MIN,
} from "@/lib/topics/draft";
import { formatDimension } from "@/lib/ui/stance-format";
import { formatConfidence } from "@/lib/ui/tag-format";

export function TagParamSliders({
  relevance,
  confidence,
  onChange,
  testIdPrefix,
  forName,
}: {
  relevance: number;
  confidence: number;
  onChange: (next: { relevance: number; confidence: number }) => void;
  testIdPrefix: string;
  /** The topic these sliders edit, so each pair names itself. */
  forName?: string;
}) {
  const relevanceId = useId();
  const confidenceId = useId();
  const marksId = useId();
  const subject = forName === undefined ? "" : ` for #${forName}`;
  return (
    <div className="flex flex-col gap-2" data-testid={`${testIdPrefix}-params`}>
      <div className="flex flex-col gap-1">
        <label htmlFor={relevanceId} className="text-label-medium">
          Relevance{subject} {formatDimension(relevance)}
        </label>
        <input
          id={relevanceId}
          data-testid={`${testIdPrefix}-relevance`}
          type="range"
          list={marksId}
          min={RELEVANCE_MIN}
          max={RELEVANCE_MAX}
          step={0.01}
          value={relevance}
          onChange={(event) => onChange({ relevance: Number(event.target.value), confidence })}
          className="w-full accent-primary"
        />
        {/* The centre-zero mark (F6): zero is where a claim is withdrawn,
            so the range says where that sits. */}
        <datalist id={marksId}>
          <option value="0" />
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={confidenceId} className="text-label-medium">
          Confidence{subject} {formatConfidence(confidence)}
        </label>
        <input
          id={confidenceId}
          data-testid={`${testIdPrefix}-confidence`}
          type="range"
          min={CONFIDENCE_MIN}
          max={CONFIDENCE_MAX}
          step={0.01}
          value={confidence}
          onChange={(event) => onChange({ relevance, confidence: Number(event.target.value) })}
          className="w-full accent-primary"
        />
      </div>
    </div>
  );
}
