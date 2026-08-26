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

import { useState } from "react";

import { newTagDraft, type TagDraft } from "@/lib/topics/draft";
import { previewTagName, TAG_BATCH_CAP } from "@/lib/topics/normalize";
import { Button } from "./button";
import { TagParamSliders } from "./tag-param-sliders";
import { TopicChip } from "./topic-chip";

export function TagEntryField({
  tags,
  onChange,
  fieldErrors,
  cap = TAG_BATCH_CAP,
  testIdPrefix,
}: {
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
  // Which chip has its sliders open; a chip is tapped to adjust it (F6).
  const [adjusting, setAdjusting] = useState<number | null>(null);

  const preview = previewTagName(draft);
  const atCap = cap !== null && tags.length >= cap;
  const typed = draft.trim() !== "";
  const canAdd = typed && preview.valid && !atCap;

  const add = () => {
    if (!canAdd) return;
    onChange([...tags, { name: preview.canonical, ...params }]);
    setDraft("");
    // Every tag starts from the server's own defaults (F6).
    setParams({ relevance: newTagDraft("").relevance, confidence: newTagDraft("").confidence });
  };

  const removeAt = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
    setAdjusting(null);
  };

  const adjustAt = (index: number, next: { relevance: number; confidence: number }) => {
    onChange(tags.map((tag, i) => (i === index ? { ...tag, ...next } : tag)));
  };

  return (
    <div className="flex flex-col gap-2" data-testid={`${testIdPrefix}-tag-entry`}>
      <label htmlFor={`${testIdPrefix}-tag-input`} className="text-label-large">
        Topics
      </label>
      {tags.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid={`${testIdPrefix}-tag-list`}>
          {tags.map((tag, index) => (
            <li key={`${tag.name}-${index}`} className="flex flex-col gap-1">
              <TopicChip
                name={tag.name}
                onRemove={() => removeAt(index)}
                removeLabel={`Remove topic #${tag.name}`}
                onSelect={() => setAdjusting(adjusting === index ? null : index)}
                selectLabel={`Adjust #${tag.name}`}
                expanded={adjusting === index}
                testId={`${testIdPrefix}-tag-${index}`}
              />
              {adjusting === index && (
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
      {/* The parameters the next tag is added with (F6). */}
      <TagParamSliders
        relevance={params.relevance}
        confidence={params.confidence}
        onChange={setParams}
        testIdPrefix={`${testIdPrefix}-tag-new`}
      />
      {atCap && (
        <p data-testid={`${testIdPrefix}-tag-cap`} className="text-body-small text-on-surface-variant">
          Up to {cap} topics per post.
        </p>
      )}
    </div>
  );
}
