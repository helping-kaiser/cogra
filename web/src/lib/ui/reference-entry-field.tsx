"use client";

// The reference section every referencing surface shares (D15, D18),
// sibling to the tag section and built the same way: add-as-chip,
// remove-before-send, and the two parameter sliders each reference
// carries. It gains a FINDER rather than a text field, because a
// reference names a node and a node cannot be typed by name (D20).
//
// D15: a mention is authored through this structured picker, NEVER by
// parsing `@handle` out of the body — display content and graph
// structure stay decoupled, and a mention resolves at render time
// against the actor's current handle, which literal body text cannot do.
//
// Purely local state. What the drafted chips become depends on the host:
// the composer batches them onto the minting record under the D7 cap,
// the edit surfaces stage each change as its own act — and a REMOVAL
// there is a withdrawal batch, not a deletion.

import { useState } from "react";

import { type ReferenceDraft } from "@/lib/references/draft";
import { REFERENCE_BATCH_CAP } from "@/lib/references/normalize";
import { Button } from "./button";
import { ReferenceChip } from "./reference-chip";
import { ReferenceFinder } from "./reference-finder";
import { ReferenceParamSliders } from "./reference-param-sliders";

export function ReferenceEntryField({
  references,
  onChange,
  fieldErrors,
  cap = REFERENCE_BATCH_CAP,
  testIdPrefix,
  finderDebounceMs,
}: {
  references: readonly ReferenceDraft[];
  onChange: (references: readonly ReferenceDraft[]) => void;
  /** Per-index refusal, keyed by the server's `["references", i, …]` path. */
  fieldErrors?: Readonly<Record<number, string>>;
  /**
   * The creation batch's cap (D7). `null` where the references are not
   * one batch — an edit surface stages a separate act per change.
   */
  cap?: number | null;
  testIdPrefix: string;
  /** Test injection, passed through to the finder's debounce. */
  finderDebounceMs?: number;
}) {
  const [finding, setFinding] = useState(false);
  // Which chip has its sliders open; a chip is tapped to adjust it.
  const [adjusting, setAdjusting] = useState<number | null>(null);

  const atCap = cap !== null && references.length >= cap;

  const add = (candidate: ReferenceDraft) => {
    // Referencing the same target twice is REFUSED rather than
    // deduplicated, so the section never stages a second one.
    if (references.some((reference) => reference.targetId === candidate.targetId)) return;
    if (atCap) return;
    onChange([...references, candidate]);
    setFinding(false);
  };

  const removeAt = (index: number) => {
    onChange(references.filter((_, i) => i !== index));
    setAdjusting(null);
  };

  const adjustAt = (index: number, next: { relevance: number; support: number }) => {
    onChange(
      references.map((reference, i) => (i === index ? { ...reference, ...next } : reference)),
    );
  };

  return (
    <div className="flex flex-col gap-2" data-testid={`${testIdPrefix}-reference-entry`}>
      <span className="text-label-large">References</span>
      {references.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid={`${testIdPrefix}-reference-list`}>
          {references.map((reference, index) => (
            <li key={reference.targetId} className="flex flex-col gap-1">
              <ReferenceChip
                target={reference.target}
                onRemove={() => removeAt(index)}
                removeLabel={`Remove the reference to ${reference.target.label}`}
                onSelect={() => setAdjusting(adjusting === index ? null : index)}
                selectLabel={`Adjust the reference to ${reference.target.label}`}
                expanded={adjusting === index}
                testId={`${testIdPrefix}-reference-${index}`}
              />
              {adjusting === index && (
                <ReferenceParamSliders
                  relevance={reference.relevance}
                  support={reference.support}
                  onChange={(next) => adjustAt(index, next)}
                  forLabel={reference.target.label}
                  testIdPrefix={`${testIdPrefix}-reference-${index}`}
                />
              )}
              {fieldErrors?.[index] !== undefined && (
                <p
                  role="alert"
                  data-testid={`${testIdPrefix}-reference-error-${index}`}
                  className="text-body-small text-error"
                >
                  {fieldErrors[index]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button
        testId={`${testIdPrefix}-reference-add`}
        variant="outline"
        size="sm"
        onClick={() => setFinding(true)}
        disabled={atCap}
      >
        Add a reference
      </Button>
      {atCap && (
        <p
          data-testid={`${testIdPrefix}-reference-cap`}
          className="text-body-small text-on-surface-variant"
        >
          Up to {cap} references per post.
        </p>
      )}
      {finding && (
        <ReferenceFinder
          onPick={add}
          onClose={() => setFinding(false)}
          alreadyDrafted={references.map((reference) => reference.targetId)}
          testIdPrefix={testIdPrefix}
          debounceMs={finderDebounceMs}
        />
      )}
    </div>
  );
}
