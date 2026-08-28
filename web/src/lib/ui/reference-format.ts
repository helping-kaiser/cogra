// How a reference's two parameters are written, shared by the surface
// that EDITS them (the sliders) and the one that REVEALS them (D16), so
// a reader who tunes a reference and a reader who inspects one meet the
// same numbers in the same shape — the tag surface's own split.
//
// D20 fixes the reader-facing words. RELEVANCE is the census's effort
// `f` in the `pDirected` slot: how load-bearing the referenced thing is
// to this post — the same word, the same signed range, and the same slot
// users met on the 2.3 tag sliders. SUPPORT is the census's enthusiasm
// `e` in the `pInterest` slot: endorsing versus refuting, the axis that
// decides whether a mention vouches. Neither census name reaches the
// screen.
//
// Both are bipolar over `[-1, 1]`, so both carry a forced sign — unlike
// a tag's confidence, which cannot go negative.

import { formatDimension } from "./stance-format";

export const RELEVANCE_LABEL = "Relevance";
export const SUPPORT_LABEL = "Support";

/**
 * The pair as the eye scans it on a revealed chip: `+0.40 · -0.10`. The
 * separator is a divider, not a word — `formatReferenceParamWords` is
 * what a screen reader gets instead (design.md §8.3's split).
 */
export function formatReferenceParams(relevance: number, support: number): string {
  return `${formatDimension(relevance)} · ${formatDimension(support)}`;
}

/** The same two values with their axes named, for a reader without the row. */
export function formatReferenceParamWords(relevance: number, support: number): string {
  return (
    `${RELEVANCE_LABEL.toLowerCase()} ${formatDimension(relevance)}, ` +
    `${SUPPORT_LABEL.toLowerCase()} ${formatDimension(support)}`
  );
}
