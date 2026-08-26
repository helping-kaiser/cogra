"use client";

// The composer's tag entry (D15, D18): free-text entry with a live
// normalization preview, add-as-chip, remove-before-send, capped at
// `TAG_BATCH_CAP`. No autocomplete — the surface that would serve one
// is the global `search` of slice 2.7. Purely local state: the drafted
// names ride the ordinary create mutation as `tags`, staged and signed
// together with the minting record (api-spec.md "A prepare may stage a
// batch").

import { useState } from "react";

import { previewTagName, TAG_BATCH_CAP } from "@/lib/topics/normalize";
import { Button } from "./button";
import { TopicChip } from "./topic-chip";

export function TagEntryField({
  tags,
  onChange,
  fieldErrors,
  testIdPrefix,
}: {
  tags: readonly string[];
  onChange: (tags: readonly string[]) => void;
  /** Per-index refusal, keyed by the server's `["tags", i, "name"]` path. */
  fieldErrors?: Readonly<Record<number, string>>;
  testIdPrefix: string;
}) {
  const [draft, setDraft] = useState("");
  const preview = previewTagName(draft);
  const atCap = tags.length >= TAG_BATCH_CAP;
  const canAdd = draft.trim() !== "" && preview.valid && !atCap;

  const add = () => {
    if (!canAdd) return;
    onChange([...tags, preview.canonical]);
    setDraft("");
  };

  const removeAt = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2" data-testid={`${testIdPrefix}-tag-entry`}>
      <label htmlFor={`${testIdPrefix}-tag-input`} className="text-label-large">
        Topics
      </label>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" data-testid={`${testIdPrefix}-tag-list`}>
          {tags.map((name, index) => (
            <li key={`${name}-${index}`}>
              <TopicChip
                name={name}
                onRemove={() => removeAt(index)}
                removeLabel={`Remove topic #${name}`}
                testId={`${testIdPrefix}-tag-${index}`}
              />
              {fieldErrors?.[index] !== undefined && (
                <p
                  role="alert"
                  data-testid={`${testIdPrefix}-tag-error-${index}`}
                  className="mt-1 text-body-small text-error"
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
      {draft.trim() !== "" && (
        <p
          data-testid={`${testIdPrefix}-tag-preview`}
          className="text-body-small text-on-surface-variant"
        >
          {preview.valid ? `Will add as #${preview.canonical}` : "Not a legal topic name"}
        </p>
      )}
      {atCap && (
        <p data-testid={`${testIdPrefix}-tag-cap`} className="text-body-small text-on-surface-variant">
          Up to {TAG_BATCH_CAP} topics per post.
        </p>
      )}
    </div>
  );
}
