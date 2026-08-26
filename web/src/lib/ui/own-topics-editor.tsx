"use client";

// The chip row's own add/remove gestures (D14, D6): each is its own
// standalone `prepareTag` act with its own signing handshake — never a
// post/comment edit field. Rendered only on the viewer's OWN content,
// and never inside the edit form (post.md §3, api-spec.md
// `PreparePostEditInput`: "New tags or citations are their own
// gestures, not edit fields").
//
// No autocomplete (D15): free-text entry with the same live
// normalization preview the composer shows.

import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { prepareTag } from "@/lib/api/topics-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { previewTagName } from "@/lib/topics/normalize";
import { Button } from "./button";
import { TopicChip } from "./topic-chip";
import type { TopicChipEntry } from "./topic-chip-row";

export function OwnTopicsEditor({
  contentId,
  topics,
  onChanged,
  testIdPrefix,
}: {
  contentId: string;
  topics: readonly TopicChipEntry[];
  /** Re-reads the host's content after a successful add/remove. */
  onChanged: () => void;
  testIdPrefix: string;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = previewTagName(draft);

  const signAll = async (writes: readonly Parameters<typeof signer.signStaged>[0][]) => {
    const results = [];
    for (const staged of writes) {
      results.push(await signer.signStaged(staged));
    }
    return results.every((result) => result.kind === "done");
  };

  const submit = async (fields: { name: string; relevance?: number }) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const prepared = await guard.run(() =>
      prepareTag(client, { target: contentId, name: fields.name, relevance: fields.relevance }),
    );
    if (prepared.kind === "refused") {
      setBusy(false);
      setError(prepared.errors[0]?.message ?? "The server refused this write.");
      return;
    }
    if (prepared.kind === "failed") {
      setBusy(false);
      setError("That didn't send. Try again.");
      return;
    }
    const done = await signAll(prepared.value);
    setBusy(false);
    if (done) {
      onChanged();
    } else {
      setError("Signing did not finish — the write stays pending.");
    }
  };

  const onAdd = async () => {
    if (draft.trim() === "" || !preview.valid) return;
    await submit({ name: preview.canonical });
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2" data-testid={`${testIdPrefix}-own-topics`}>
      {topics.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <li key={topic.name}>
              <TopicChip
                name={topic.name}
                href={`/topics/${topic.name}`}
                pending={topic.pending}
                onRemove={() => void submit({ name: topic.name, relevance: 0 })}
                removeLabel={`Remove topic #${topic.name}`}
                testId={`${testIdPrefix}-topic-${topic.name}`}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor={`${testIdPrefix}-tag-input`} className="sr-only">
          Add a topic
        </label>
        <input
          id={`${testIdPrefix}-tag-input`}
          data-testid={`${testIdPrefix}-tag-input`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onAdd();
            }
          }}
          placeholder="Add a topic"
          className="rounded-extra-small border border-outline bg-transparent px-3 py-1 text-body-medium"
        />
        <Button
          testId={`${testIdPrefix}-tag-add`}
          variant="outline"
          size="sm"
          onClick={() => void onAdd()}
          disabled={busy || draft.trim() === "" || !preview.valid}
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
      {error !== null && (
        <p role="alert" data-testid={`${testIdPrefix}-tag-error`} className="text-body-small text-error">
          {error}
        </p>
      )}
    </div>
  );
}
