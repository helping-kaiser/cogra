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
//
// TWO WAYS A STAGED CITATION'S PAIR IS SET, BY HOST (`pairs`), the tag
// section's split: the composer's details stage draws `RefPair`
// (ComposeDetails.md: "WHEN tap composeDetails.references.stagedReference
// -> the citation's pair opens in a sheet over the stage"), committed on
// Done and discarded on every other way out; the edit surfaces keep their
// inline sliders until their own sheet (`RefPairEdit`) is built.

import { useState } from "react";

import { type ReferenceDraft } from "@/lib/references/draft";
import { REFERENCE_BATCH_CAP } from "@/lib/references/normalize";
import { CITATION_FAMILY, PairSheet } from "@/lib/ui2/compose/pair-sheet";
import { InlineAction } from "@/lib/ui2/inline-action";
import { instance, part, testAttributes, type DataNode } from "./data-node";
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
  node,
  pairs = "inline",
}: {
  /**
   * The registered section node on a registered screen
   * (`composeDetails.references`): its `label`, each staged chip as its
   * `stagedReference` (keyed by position, counted from 1), and its `add`.
   */
  node?: DataNode;
  /**
   * Where a staged citation's pair is set: `"sheet"` is the composer's
   * `RefPair` (tap the citation, set the pair, Done); `"inline"` is the
   * edit surfaces' sliders.
   */
  pairs?: "sheet" | "inline";
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
  // Which chip has its pair open — its inline sliders, or its sheet; a chip
  // is tapped to adjust it.
  const [adjusting, setAdjusting] = useState<number | null>(null);
  // The citation the sheet last showed, kept past its close so the title
  // holds through the sheet's exit.
  const [sheetIndex, setSheetIndex] = useState(0);
  const sheetReference = pairs === "sheet" ? references[sheetIndex] : undefined;

  const select = (index: number) => {
    if (pairs === "sheet") {
      setSheetIndex(index);
      setAdjusting(index);
      return;
    }
    setAdjusting(adjusting === index ? null : index);
  };

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
    <div
      className="flex flex-col gap-2"
      {...testAttributes(node, `${testIdPrefix}-reference-entry`)}
    >
      <span className="text-label-large" {...testAttributes(part(node, "label"))}>
        References
      </span>
      {references.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid={`${testIdPrefix}-reference-list`}>
          {references.map((reference, index) => (
            <li key={reference.targetId} className="flex flex-col gap-1">
              <ReferenceChip
                target={reference.target}
                onRemove={() => removeAt(index)}
                removeLabel={`Remove the reference to ${reference.target.label}`}
                onSelect={() => select(index)}
                selectLabel={`Adjust the reference to ${reference.target.label}`}
                expanded={adjusting === index}
                testId={`${testIdPrefix}-reference-${index}`}
                node={instance(node, "stagedReference", String(index + 1))}
              />
              {pairs === "inline" && adjusting === index && (
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
      {/* The composers' own word and weight (`ComposeDetailsBody`, `EditCompose`,
          `ReplySeal`): a quiet "+ Cite something" under the staged rows,
          opening the finder. */}
      <InlineAction
        testId={`${testIdPrefix}-reference-add`}
        node={part(node, "add")}
        size="sm"
        onClick={() => setFinding(true)}
        disabled={atCap}
      >
        + Cite something
      </InlineAction>
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
      {sheetReference !== undefined && (
        <PairSheet
          open={adjusting !== null}
          title={sheetReference.target.label}
          value={{ pDirected: sheetReference.relevance, pInterest: sheetReference.support }}
          family={CITATION_FAMILY}
          // Done is the one way the sheet's pair reaches the staged citation.
          onDone={(pair) => {
            adjustAt(sheetIndex, { relevance: pair.pDirected, support: pair.pInterest });
            setAdjusting(null);
          }}
          // Scrim, swipe down, Back, Escape: the citation keeps what it had.
          onDiscard={() => setAdjusting(null)}
          testId={`${testIdPrefix}-reference-pair`}
        />
      )}
    </div>
  );
}
