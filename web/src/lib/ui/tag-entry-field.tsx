"use client";

// The tag entry every tagging surface shares (D15, D18): free-text entry
// with a live normalization preview, add-as-chip, remove-before-send, and
// the two parameter sliders each tag carries (F6). No autocomplete — the
// surface that would serve one is the global `search` of slice 2.7.
//
// F1: the Add action is GATED on the atom check and says why while the
// name is still being typed. The gate is UX, not validation — the
// server's field-level refusal on `["tags", i, "name"]` stays the
// authority, and lands back here as `fieldErrors`.
//
// Purely local state. What the drafted chips become depends on the host:
// the composer batches them onto the minting record, the edit screen
// stages each change as its own Tag act.
//
// TWO WAYS A CHIP'S PAIR IS SET, BY HOST (`pairs`). The composer's details
// stage draws `TagPadCompose` (ComposeDetails.md: "WHEN tap
// composeDetails.tags.tag -> the tag's pair opens in a sheet over the
// stage"): a tag is staged at the contract's +0.1 / 1, and its pair is set
// afterwards, in that sheet, committed on Done and discarded on every other
// way out. No pair stands loose beside the entry — that was build drift, a
// pre-add pair that staged the NEXT chip and reset after Add. The edit
// surfaces keep their inline sliders until their own sheet (`TagPad`, with
// its `Un-tag`) is built.

import { useState } from "react";

import { newTagDraft, type TagDraft } from "@/lib/topics/draft";
import { previewTagName, TAG_BATCH_CAP } from "@/lib/topics/normalize";
import { PairSheet, TAG_FAMILY } from "@/lib/ui2/compose/pair-sheet";
import { Button } from "./button";
import { instance, part, testAttributes, type DataNode } from "./data-node";
import { TagParamSliders } from "./tag-param-sliders";
import { TopicChip } from "./topic-chip";

export function TagEntryField({
  tags,
  onChange,
  fieldErrors,
  cap = TAG_BATCH_CAP,
  testIdPrefix,
  node,
  pairs = "inline",
}: {
  /**
   * Where a chip's pair is set: `"sheet"` is the composer's `TagPadCompose`
   * (tap a chip, set the pair, Done); `"inline"` is the edit surfaces'
   * sliders, a pre-add pair included.
   */
  pairs?: "sheet" | "inline";
  /**
   * The registered section node on a registered screen (`composeDetails.tags`):
   * its `label`, each staged chip as its `tag` (keyed by the name) with the
   * chip's `remove`, and its `add` control.
   */
  node?: DataNode;
  tags: readonly TagDraft[];
  onChange: (tags: readonly TagDraft[]) => void;
  /** Per-index refusal, keyed by the server's `["tags", i, "name"]` path. */
  fieldErrors?: Readonly<Record<number, string>>;
  /**
   * The creation batch's cap (D18). `null` where the tags are not one
   * batch — the edit screen stages a separate act per change.
   */
  cap?: number | null;
  testIdPrefix: string;
}) {
  const [draft, setDraft] = useState("");
  const [params, setParams] = useState(() => {
    const { relevance, confidence } = newTagDraft("");
    return { relevance, confidence };
  });
  // Which chip has its pair open — its inline sliders, or its sheet; a chip
  // is tapped to adjust it (F6).
  const [adjusting, setAdjusting] = useState<number | null>(null);
  // The chip the sheet last showed, kept past its close so the title holds
  // through the sheet's exit rather than blanking mid-drop.
  const [sheetIndex, setSheetIndex] = useState(0);
  const sheetTag = pairs === "sheet" ? tags[sheetIndex] : undefined;

  const preview = previewTagName(draft);
  const atCap = cap !== null && tags.length >= cap;
  const typed = draft.trim() !== "";
  const canAdd = typed && preview.valid && !atCap;

  const add = () => {
    if (!canAdd) return;
    // On the composer a tag is staged at the contract's +0.1 / 1
    // (ComposeDetails.md) and its pair is set in its sheet afterwards.
    const added = pairs === "sheet" ? newTagDraft(preview.canonical) : { name: preview.canonical, ...params };
    onChange([...tags, added]);
    setDraft("");
    // Every tag starts from the server's own defaults (F6).
    setParams({ relevance: newTagDraft("").relevance, confidence: newTagDraft("").confidence });
  };

  const select = (index: number) => {
    if (pairs === "sheet") {
      setSheetIndex(index);
      setAdjusting(index);
      return;
    }
    setAdjusting(adjusting === index ? null : index);
  };

  const removeAt = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
    setAdjusting(null);
  };

  const adjustAt = (index: number, next: { relevance: number; confidence: number }) => {
    onChange(tags.map((tag, i) => (i === index ? { ...tag, ...next } : tag)));
  };

  return (
    <div className="flex flex-col gap-2" {...testAttributes(node, `${testIdPrefix}-tag-entry`)}>
      <label
        htmlFor={`${testIdPrefix}-tag-input`}
        className="text-label-large"
        {...testAttributes(part(node, "label"))}
      >
        Tags
      </label>
      {tags.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid={`${testIdPrefix}-tag-list`}>
          {tags.map((tag, index) => (
            <li key={`${tag.name}-${index}`} className="flex flex-col gap-1">
              <TopicChip
                name={tag.name}
                onRemove={() => removeAt(index)}
                removeLabel={`Remove topic #${tag.name}`}
                onSelect={() => select(index)}
                selectLabel={`Adjust #${tag.name}`}
                expanded={adjusting === index}
                testId={`${testIdPrefix}-tag-${index}`}
                node={instance(node, "tag", tag.name)}
                removeNode={part(instance(node, "tag", tag.name), "remove")}
              />
              {pairs === "inline" && adjusting === index && (
                <TagParamSliders
                  relevance={tag.relevance}
                  confidence={tag.confidence}
                  onChange={(next) => adjustAt(index, next)}
                  forName={tag.name}
                  testIdPrefix={`${testIdPrefix}-tag-${index}`}
                />
              )}
              {fieldErrors?.[index] !== undefined && (
                <p
                  role="alert"
                  data-testid={`${testIdPrefix}-tag-error-${index}`}
                  className="text-body-small text-error"
                >
                  {fieldErrors[index]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          id={`${testIdPrefix}-tag-input`}
          data-testid={`${testIdPrefix}-tag-input`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Add a topic"
          aria-describedby={`${testIdPrefix}-tag-preview`}
          className="rounded-extra-small border border-outline bg-transparent px-3 py-2"
        />
        <Button
          testId={`${testIdPrefix}-tag-add`}
          node={part(node, "add")}
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!canAdd}
        >
          Add
        </Button>
      </div>
      {/* One line, always in the same slot: what the name becomes, or why
          it cannot be added (F1). */}
      {typed && (
        <p
          id={`${testIdPrefix}-tag-preview`}
          role={preview.valid ? undefined : "alert"}
          data-testid={`${testIdPrefix}-tag-preview`}
          className={
            preview.valid
              ? "text-body-small text-on-surface-variant"
              : "text-body-small text-error"
          }
        >
          {preview.valid ? `Will add as #${preview.canonical}` : preview.reason}
        </p>
      )}
      {/* The parameters the next tag is added with (F6) — inline hosts only;
          the composer stages at the default and sets the pair in the sheet. */}
      {pairs === "inline" && (
        <TagParamSliders
          relevance={params.relevance}
          confidence={params.confidence}
          onChange={setParams}
          testIdPrefix={`${testIdPrefix}-tag-new`}
        />
      )}
      {atCap && (
        <p data-testid={`${testIdPrefix}-tag-cap`} className="text-body-small text-on-surface-variant">
          Up to {cap} topics per post.
        </p>
      )}
      {sheetTag !== undefined && (
        <PairSheet
          open={adjusting !== null}
          title={`#${sheetTag.name}`}
          value={{ pDirected: sheetTag.relevance, pInterest: sheetTag.confidence }}
          family={TAG_FAMILY}
          // Done is the one way the sheet's pair reaches the staged chip.
          onDone={(pair) => {
            adjustAt(sheetIndex, { relevance: pair.pDirected, confidence: pair.pInterest });
            setAdjusting(null);
          }}
          // Scrim, swipe down, Back, Escape: the chip keeps what it had.
          onDiscard={() => setAdjusting(null)}
          testId={`${testIdPrefix}-tag-pair`}
        />
      )}
    </div>
  );
}
