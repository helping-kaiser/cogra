"use client";

// The read-only chip row (design.md §6): a post or comment card's
// current topics (`Post.topics` / `Comment.topics`), each chip
// navigating to its topic route. D8: the server already serves only
// the content author's own current tags this slice — this component
// renders exactly what it is given, with no further filtering.
//
// F8: anyone may see how strongly a topic is claimed — but only when
// they ASK. The detail view passes `revealable`, which puts ONE toggle
// on the row; the feed card passes nothing and stays plain. The values
// enter the DOM only while revealed, so a screen reader meets them the
// same moment the eye does rather than reading a hidden pair on every
// card.

import { useId, useState } from "react";

import { TopicChip } from "./topic-chip";
import { formatTagParams, formatTagParamWords } from "./tag-format";

export type TopicChipEntry = {
  readonly name: string;
  readonly pending: boolean;
  /** The claim's `(relevance, confidence)`, for a row that can reveal. */
  readonly relevance?: number;
  readonly confidence?: number;
};

export function TopicChipRow({
  topics,
  testIdPrefix,
  revealable = false,
}: {
  topics: readonly TopicChipEntry[];
  testIdPrefix: string;
  /** F8: offer the values toggle. Detail surfaces only — never a card. */
  revealable?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const listId = useId();
  if (topics.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <ul
        id={listId}
        className="flex flex-wrap gap-2"
        data-testid={`${testIdPrefix}-topics`}
      >
        {topics.map((topic) => (
          <li key={topic.name} className="flex items-center gap-1">
            <TopicChip
              name={topic.name}
              href={`/topics/${topic.name}`}
              pending={topic.pending}
              testId={`${testIdPrefix}-topic-${topic.name}`}
            />
            {revealable && revealed && (
              <span
                data-testid={`${testIdPrefix}-topic-${topic.name}-values`}
                className="text-label-small text-on-surface-variant"
              >
                {/* The compact pair for the eye, the named axes for a
                    reader who has no row in front of them — the stance
                    readout's own split (design.md §8.3). */}
                <span aria-hidden="true">
                  {formatTagParams(topic.relevance ?? 0, topic.confidence ?? 0)}
                </span>
                <span className="sr-only">
                  {formatTagParamWords(topic.relevance ?? 0, topic.confidence ?? 0)}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* One affordance for the whole row, not one per chip: the reader
          asks about the claims, not about a claim. A plain button, so
          Enter/Space and the expanded state come from the platform. */}
      {revealable && (
        <button
          type="button"
          aria-expanded={revealed}
          aria-controls={listId}
          data-testid={`${testIdPrefix}-topics-reveal`}
          onClick={() => setRevealed((current) => !current)}
          className="self-start text-label-small text-on-surface-variant underline"
        >
          {revealed ? "Hide topic values" : "Show topic values"}
        </button>
      )}
    </div>
  );
}
