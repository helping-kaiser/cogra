"use client";

// The topics-and-citations line a content card wears, shared by the post card
// and the comment card — `design/components/content/TopicsLine.jsx`.
//
// AT MOST TWO CHIPS, THEN THE COUNTS (design/readme.md §13, 2026-08-28). A
// clipped parade of half-chips says nothing, so the line shows up to two topics
// whole and states the rest in words: `· 23 topics · 3 references`. Never a
// wrap, never a second row: that is the collapse order, and a card never lists
// its references inline.
//
// A CHIP IS NEVER CUT (jakob's ruling, hand test 2026-09-09). The master caps
// each chip at 96px and ellipsises what overruns
// (`design/components/content/TopicsLine.jsx:19-28`), which contradicts its own
// prose — "the line shows up to two topics WHOLE" — and is the truncation the
// ruling forbids. So the cap becomes a SELECTION rule rather than a clipping
// one: a chip whose whole label fits is drawn, and one that does not falls into
// the counts, which already exist to state what the line does not show. Where
// nothing fits, the line is its counts alone. The divergence from the master is
// deliberate and recorded; the master is the thing that needs the correction.
//
// FITTING IS MEASURED, AND MEASURED BEFORE THE FIRST PAINT. Whether a label
// fits depends on the reader's width and font, so it cannot be guessed from a
// character budget without either cutting a chip on a narrow screen or dropping
// one that had room. The hidden probe below carries every candidate at its
// natural width, `useLayoutEffect` reads them and commits the count React then
// renders synchronously — so the browser never paints an intermediate. Until
// that first measurement the line is its counts, which is the ruling's own
// fallback rather than an invented in-between state.
//
// THE COUNTS ARE ALSO THE WAY IN. The topics-and-references sheet is the full
// set's home, and it is an undesigned-here surface until W3 draws it — so this
// line takes its handlers rather than inventing a destination: `onOpenReferences`
// makes the counts the sheet's opener in a summary card, and `onOpen` makes the
// WHOLE LINE one control on a detail surface, the chips inert inside it. Given
// neither, the counts are a plain fact and nothing here is a control that goes
// nowhere.

import { useCallback, useRef, useState } from "react";

import { useMeasureEffect } from "./measure-effect";
import { TopicChip } from "./topic-chip";

export type TopicsLineEntry = {
  readonly name: string;
  /**
   * Whether the winning claim is still in flight. The line does not mark it:
   * the marker it used to wear was a `…` glyph inside the chip, which is the
   * one thing a chip may never end in, and the design system draws no per-chip
   * pending state to put in its place (`PendingMarker` is a line under content,
   * not a chip's tail). Carried because callers have it, unread until drawn.
   */
  readonly pending: boolean;
};

/** The master's own ceiling: a card states the rest in words past two. */
const VISIBLE_CHIPS = 2;

/** `gap-2`, in px — the measurement has to account for what CSS inserts. */
const GAP_PX = 8;

/** The counts, or null where there is nothing left to state. */
export function countsText(hiddenTopics: number, references: number): string | null {
  const parts: string[] = [];
  if (hiddenTopics > 0) parts.push(hiddenTopics === 1 ? "1 topic" : `${hiddenTopics} topics`);
  if (references > 0) parts.push(references === 1 ? "1 reference" : `${references} references`);
  if (parts.length === 0) return null;
  return `· ${parts.join(" · ")}`;
}

/**
 * How many leading chips fit whole on one line of `lineWidth`.
 *
 * `countsWidths[k]` is the width the counts take when `k` chips are shown —
 * they are not one string, because a dropped chip is a counted topic. Widest
 * candidate first, so the answer is the most chips the line can hold; 0 means
 * the counts alone.
 */
export function chipsThatFit(
  lineWidth: number,
  chipWidths: readonly number[],
  countsWidths: readonly number[],
): number {
  // An unmeasurable line — laid out at zero width, or inside a hidden
  // ancestor — says nothing about what fits, and dropping chips on the
  // strength of it would hide them for good in a tree that never resizes.
  // The observer re-reads the moment the line has a width.
  if (lineWidth <= 0) return chipWidths.length;
  for (let shown = chipWidths.length; shown > 0; shown -= 1) {
    const counts = countsWidths[shown] ?? 0;
    const items = shown + (counts > 0 ? 1 : 0);
    const total =
      chipWidths.slice(0, shown).reduce((sum, width) => sum + width, 0) +
      counts +
      GAP_PX * Math.max(0, items - 1);
    if (total <= lineWidth) return shown;
  }
  return 0;
}

const LINE = "relative flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden";
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
  const candidates = topics.slice(0, VISIBLE_CHIPS);
  const lineRef = useRef<HTMLElement | null>(null);
  const chipProbeRef = useRef<HTMLSpanElement | null>(null);
  const countsProbeRef = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(0);

  // A callback ref because the line is a `div` on a summary card and a
  // `button` on a detail one, and one `useRef` cannot be typed as both.
  const holdLine = useCallback((node: HTMLElement | null) => {
    lineRef.current = node;
  }, []);

  const measure = useCallback(() => {
    const line = lineRef.current;
    const chipProbe = chipProbeRef.current;
    const countsProbe = countsProbeRef.current;
    if (!line || !chipProbe || !countsProbe) return;
    const widthOf = (element: Element) => element.getBoundingClientRect().width;
    setShown(
      chipsThatFit(
        line.clientWidth,
        Array.from(chipProbe.children, widthOf),
        Array.from(countsProbe.children, widthOf),
      ),
    );
  }, []);

  useMeasureEffect(() => {
    measure();
    const line = lineRef.current;
    // The card's width follows the viewport, and a rotation must not leave a
    // chip half off the line — so the fit is re-read whenever the line resizes.
    if (!line || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(line);
    return () => observer.disconnect();
  }, [measure]);

  if (topics.length === 0 && references === 0) return null;

  const visible = candidates.slice(0, shown);
  const counts = countsText(topics.length - visible.length, references);

  // Every candidate at its natural width, plus the counts each choice would
  // leave — out of flow and out of the accessibility tree, so it costs the
  // reader nothing and the line's own layout nothing.
  const probe = (
    <span
      aria-hidden="true"
      className="pointer-events-none invisible absolute left-0 top-0 flex flex-nowrap whitespace-nowrap"
    >
      <span ref={chipProbeRef} className="flex flex-nowrap">
        {candidates.map((topic) => (
          <TopicChip key={topic.name} name={topic.name} capped testId={undefined} />
        ))}
      </span>
      <span ref={countsProbeRef} className="flex flex-nowrap">
        {Array.from({ length: candidates.length + 1 }, (_, kept) => (
          <span key={kept} className={COUNTS}>
            {countsText(topics.length - kept, references) ?? ""}
          </span>
        ))}
      </span>
    </span>
  );

  const chips = visible.map((topic) => (
    <TopicChip
      key={topic.name}
      name={topic.name}
      href={onOpen ? undefined : `/topics/${topic.name}`}
      capped
      testId={`${testIdPrefix}-topic-${topic.name}`}
    />
  ));

  if (onOpen) {
    return (
      <button
        ref={holdLine}
        type="button"
        onClick={onOpen}
        aria-label="Topics and references"
        data-testid={`${testIdPrefix}-topics`}
        className={`cg-state cg-focus w-full text-left ${LINE}`}
      >
        {probe}
        {chips}
        {counts !== null && (
          <span className={COUNTS} data-testid={`${testIdPrefix}-topics-counts`}>
            {counts}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={holdLine}
      className={LINE}
      data-testid={`${testIdPrefix}-topics`}
    >
      {probe}
      {chips}
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
