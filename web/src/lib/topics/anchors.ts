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
