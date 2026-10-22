// The thirteen objects a TAG's pair reads as — the tag table of
// design/readme.md §13 ("The tag pad — 2026-09-10"), drawn wherever a tag's
// two parameters are shown without the pad beside them.
//
// IT IS DISJOINT FROM THE STANCE FACES, deliberately: not one glyph appears
// in both tables. A face that means "Like this" about a post must never also
// mean "locked on" about a topic, or the one lossy readout the system has
// starts lying about which family a reader is looking at. A tag is a claim
// about what a post is about and has no mood to wear, so its table is objects
// rather than faces.
//
// THE GRID IS FOUR BY THREE, plus a floating thirteenth. Aboutness runs
// Barely → Entirely across the relevance bands (0.15, 0.45, 0.72, 0.95),
// certainty runs Guessing → Certain up the confidence bands (0.15, 0.55,
// 0.90), and the twelve sit at the band centres. 💯 floats at 0.86 / 0.95, so
// the very top of the field is reachable without taking the Entirely corner
// from the row that owns it.
//
// Like the stance anchors, these values are the contract both clients read;
// `anchors.test.ts` pins them against the design bundle rather than trusting
// the transcription.

import { UNREACHABLE_EMOJI, ZERO_BUNDLE_EMOJI } from "@/lib/stance/anchors";

/** A place in the tag field, its object, and the words a reader hears. */
export type TagAnchor = {
  /** Relevance `r` — how much the topic is the content's. */
  readonly relevance: number;
  /** Confidence `c`, census-bounded to `[0, 1]` (hashtag.md §4). */
  readonly confidence: number;
  readonly emoji: string;
  readonly label: string;
};

export const TAG_ANCHORS: readonly TagAnchor[] = [
  { relevance: 0.15, confidence: 0.9, emoji: "🔍", label: "had to look, but it's in there" },
  { relevance: 0.45, confidence: 0.9, emoji: "🔗", label: "definitely linked" },
  { relevance: 0.72, confidence: 0.9, emoji: "🔒", label: "locked on" },
  { relevance: 0.95, confidence: 0.9, emoji: "🎯", label: "exactly this" },
  { relevance: 0.15, confidence: 0.55, emoji: "💧", label: "a drop of it, I think" },
  { relevance: 0.45, confidence: 0.55, emoji: "🧩", label: "a piece of the picture" },
  { relevance: 0.72, confidence: 0.55, emoji: "🧲", label: "pulled toward it" },
  { relevance: 0.95, confidence: 0.55, emoji: "🗝️", label: "likely the key to it" },
  { relevance: 0.15, confidence: 0.15, emoji: "❔", label: "faint maybe" },
  { relevance: 0.45, confidence: 0.15, emoji: "🎲", label: "could go either way" },
  { relevance: 0.72, confidence: 0.15, emoji: "🎣", label: "fishing for it" },
  { relevance: 0.95, confidence: 0.15, emoji: "🔮", label: "big claim, divined" },
  { relevance: 0.86, confidence: 0.95, emoji: "💯", label: "all of it, full stop" },
];

/**
 * The bare table walk. Nothing outside this file calls it: every tag pair
 * drawn as a face reads through [tagReadout], which answers the zero lines
 * first (the master's structure, seam 243).
 *
 * The nearest tag anchor by Euclidean distance — the same walk the stance
 * table takes, over the thirteen objects rather than the twenty faces.
 * Squared distance orders the same way and skips the root; the first of an
 * exact tie wins, so the result is a total function of the pair rather than
 * of iteration luck.
 */
export function nearestTagAnchor(relevance: number, confidence: number): TagAnchor {
  let best = TAG_ANCHORS[0] as TagAnchor;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of TAG_ANCHORS) {
    const dr = anchor.relevance - relevance;
    const dc = anchor.confidence - confidence;
    const distance = dr * dr + dc * dc;
    if (distance < bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}

/** What a tag pair reads as wherever a face is drawn: the glyph and the spoken word. */
export type TagReadout = {
  readonly emoji: string;
  readonly label: string;
};

/** A tag at `(0, 0)` is withdrawn (the master's `TAG_WITHDRAWN_LABEL`). */
export const TAG_WITHDRAWN_LABEL = "withdrawn";

/**
 * A tag at zero on ONE number is routing-inert but not withdrawn — a claim,
 * not nothing — and says which number is the zero (the master's
 * `tagUnreachableHead`).
 */
export function tagUnreachableHead(relevance: number): string {
  return relevance === 0 ? "not about it at all" : "no certainty at all";
}

/**
 * A TAG'S PAIR FOLLOWS THE SAME LAW AS A STANCE'S (jakob 2026-10-21; the
 * master's `tagReadout`): it shrugs at `(0, 0)`, thinks at exactly one zero,
 * and reads the thirteen objects otherwise — in the tag family's own words,
 * never a stance's.
 */
export function tagReadout(relevance: number, confidence: number): TagReadout {
  const relevanceZero = relevance === 0;
  const confidenceZero = confidence === 0;
  // The same two zero faces a stance pair wears — outside both tables.
  if (relevanceZero && confidenceZero) return { emoji: ZERO_BUNDLE_EMOJI, label: TAG_WITHDRAWN_LABEL };
  if (relevanceZero || confidenceZero) {
    return { emoji: UNREACHABLE_EMOJI, label: tagUnreachableHead(relevance) };
  }
  return nearestTagAnchor(relevance, confidence);
}
