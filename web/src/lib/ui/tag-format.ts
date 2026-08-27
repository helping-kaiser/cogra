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
