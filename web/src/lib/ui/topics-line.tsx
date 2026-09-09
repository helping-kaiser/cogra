"use client";

// The topics-and-citations line a content card wears, shared by the post card
// and the comment card — `design/components/content/TopicsLine.jsx`.
//
// AT MOST TWO CHIPS, THEN THE COUNTS (design/readme.md §13, 2026-08-28). A
// clipped parade of half-chips says nothing, so the line shows up to two topics
// whole — each capped so both always fit beside the counts — and states the
// rest in words: `· 23 topics · 3 references`. Never a wrap, never a second
// row: that is the collapse order, and a card never lists its references
// inline.
//
// THE COUNTS ARE ALSO THE WAY IN. The topics-and-references sheet is the full
// set's home, and it is an undesigned-here surface until W3 draws it — so this
// line takes its handlers rather than inventing a destination: `onOpenReferences`
// makes the counts the sheet's opener in a summary card, and `onOpen` makes the
// WHOLE LINE one control on a detail surface, the chips inert inside it. Given
// neither, the counts are a plain fact and nothing here is a control that goes
// nowhere.

import { TopicChip } from "./topic-chip";

export type TopicsLineEntry = {
  readonly name: string;
  readonly pending: boolean;
};

/** Two capped chips plus the counts fit a 390px card at its 16px insets. */
const VISIBLE_CHIPS = 2;

/** The counts, or null where there is nothing left to state. */
export function countsText(hiddenTopics: number, references: number): string | null {
  const parts: string[] = [];
  if (hiddenTopics > 0) parts.push(hiddenTopics === 1 ? "1 topic" : `${hiddenTopics} topics`);
  if (references > 0) parts.push(references === 1 ? "1 reference" : `${references} references`);
  if (parts.length === 0) return null;
  return `· ${parts.join(" · ")}`;
}

const LINE = "flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden";
const COUNTS = "flex-none whitespace-nowrap text-body-small text-on-surface-variant";

export function TopicsLine({
  topics,
  references,
  testIdPrefix,
  onOpen,
  onOpenReferences,
}: {
  topics: readonly TopicsLineEntry[];
  /** How many citations the node carries — a number on a card, never a row. */
  references: number;
  testIdPrefix: string;
  /** A detail surface: the whole line opens the sheet, the chips inert. */
  onOpen?: () => void;
  /** A summary card: the counts open the sheet, the chips still navigate. */
  onOpenReferences?: () => void;
}) {
  if (topics.length === 0 && references === 0) return null;
  const visible = topics.slice(0, VISIBLE_CHIPS);
  const counts = countsText(topics.length - visible.length, references);

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Topics and references"
        data-testid={`${testIdPrefix}-topics`}
        className={`cg-state cg-focus w-full text-left ${LINE}`}
      >
        {visible.map((topic) => (
          <TopicChip
            key={topic.name}
            name={topic.name}
            pending={topic.pending}
            capped
            testId={`${testIdPrefix}-topic-${topic.name}`}
          />
        ))}
        {counts !== null && (
          <span className={COUNTS} data-testid={`${testIdPrefix}-topics-counts`}>
            {counts}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={LINE} data-testid={`${testIdPrefix}-topics`}>
      {visible.map((topic) => (
        <TopicChip
          key={topic.name}
          name={topic.name}
          href={`/topics/${topic.name}`}
          pending={topic.pending}
          capped
          testId={`${testIdPrefix}-topic-${topic.name}`}
        />
      ))}
      {counts !== null &&
        (onOpenReferences ? (
          <button
            type="button"
            onClick={onOpenReferences}
            data-testid={`${testIdPrefix}-topics-counts`}
            className={`cg-state cg-focus ${COUNTS}`}
          >
            {counts}
          </button>
        ) : (
          <span className={COUNTS} data-testid={`${testIdPrefix}-topics-counts`}>
            {counts}
          </span>
        ))}
    </div>
  );
}
