// How a tag's two parameters are written, shared by the surface that
// EDITS them (the sliders) and the one that REVEALS them (F8), so a
// reader who tunes a claim and a reader who inspects one meet the same
// numbers in the same shape.
//
// Relevance is bipolar, so its sign carries the direction and is shown
// even at zero; confidence is `[0, 1]` and reads without a forced sign.

import { formatDimension } from "./stance-format";

/** Confidence never goes negative, so it reads without a forced sign. */
export function formatConfidence(value: number): string {
  return value.toFixed(2);
}

/**
 * The pair as the eye scans it on a revealed chip: `+0.40 · 0.90`. The
 * separator is a divider, not a word — `formatTagParamWords` is what a
 * screen reader gets instead (the stance readout's own split, §8.3).
 */
export function formatTagParams(relevance: number, confidence: number): string {
  return `${formatDimension(relevance)} · ${formatConfidence(confidence)}`;
}

/** The same two values with their axes named, for a reader without the row. */
export function formatTagParamWords(relevance: number, confidence: number): string {
  return `relevance ${formatDimension(relevance)}, confidence ${formatConfidence(confidence)}`;
}

/**
 * The pair as the REVEAL writes it — `+0.40 / 0.90`
 * (`StanceReadout.jsx`'s `formatTagPair`, the shape `RefsSheet` draws).
 *
 * THE TWO FAMILIES ARE SIGNED DIFFERENTLY AND THE ROW SAYS SO. Relevance is
 * a signed Dimension and keeps its sign; confidence is census-bounded to
 * `[0, 1]` (hashtag.md §4), so a `+` on it would advertise a pole that does
 * not exist. A citation's pair carries a sign on both axes
 * (`formatStancePair`), and a reader who can tell the two apart at a glance
 * is being told the truth about which family they are looking at.
 *
 * The separator is the sheet's own `/`, where the chip's revealed pair uses
 * `·`: the row stacks the pair under a face and the slash is what the master
 * draws there.
 */
export function formatTagPair(relevance: number, confidence: number): string {
  return `${formatDimension(relevance)} / ${formatConfidence(confidence)}`;
}
