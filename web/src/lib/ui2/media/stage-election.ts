// THE STAGE LAW'S ELECTION, as a pure function: which of a scroll surface's
// clips is entitled to play, given who held the stage and where every clip
// stands. A 1:1 port of android's `StageElection.elect`
// (`android/core/designsystem/.../v2/media/ScrollStage.kt`) extended with what
// the web's executed law adds — suppressed autoplay and the play-disc hand
// start (design/designs/canonical/behavior/Feed.md, FeedCover.md; the
// stage-law packet §3.2 rules 1–4, 2a, 6, 8, 10).
//
// Pure on purpose, as android's is: each clause of the law is testable without
// mounting anything, and the surface that hosts the stage — its observer, its
// scroller, its covering layers — only has to measure and ask.
//
// What it decides, and what it does not. The election says which clip is
// ENTITLED to play. Playing it is the player layer's business (`video-stage.ts`),
// and a sheet or dialog over the surface is not a clause here but the absence
// of an election: a suspended surface has no holder at all.

/**
 * How much of a clip has to be on screen before it may play — the 70% gate
 * (design/readme.md §13; `MediaAttachment.prompt.md:17`). The gate itself
 * qualifies.
 */
export const GATE = 0.7;

/** Where one clip stands on its surface, as the last observer batch measured it. */
export type StagePlace = {
  /** The fraction of the frame on screen, 0..1 — the observer's `intersectionRatio`. */
  ratio: number;
  /** Whether a sensitive veil covers the frame now: a veiled clip never qualifies. */
  veiled: boolean;
  /** Whether the clip took the stage by a play-disc tap (FeedCover.md:27). */
  handStarted: boolean;
  /**
   * Whether a hand-started clip has stood at or past the gate since the tap
   * (Feed.md:25/27). Meaningless for a clip that was not hand-started.
   */
  qualifiedSinceTap: boolean;
};

/** A clip and its place, in the surface's order. */
export type StageEntry<K> = { key: K; place: StagePlace };

/** The law's word for a clip that may take the stage: past the gate, unveiled. */
export function qualifies(place: StagePlace): boolean {
  return !place.veiled && place.ratio >= GATE;
}

/**
 * Whether an INCUMBENT keeps the stage on its own standing.
 *
 * A qualifying clip does (Feed.md:9). So does a clip the reader started by its
 * play disc below the gate, while any of it stands on screen and until it has
 * qualified since the tap (Feed.md:25) — once it has, it is an ordinary
 * hand-started incumbent and falling below the gate hands the stage on
 * (FeedCover.md:29). A veil ends either standing (Feed.md:43).
 */
function holds(place: StagePlace): boolean {
  if (qualifies(place)) return true;
  return place.handStarted && !place.qualifiedSinceTap && !place.veiled && place.ratio > 0;
}

export type ElectionInput<K> = {
  /** The clip on stage before this decision, or null. */
  incumbent: K | null;
  /**
   * Every clip on the surface, IN THE SURFACE'S ORDER (document order — see
   * {@link documentOrder}). A clip that left the surface is simply absent.
   */
  places: readonly StageEntry<K>[];
  /**
   * Whether the scroll has just settled at the surface's hard top
   * (Feed.md:19/21) — the edge into resting there, never the resting itself.
   */
  landedAtHardTop?: boolean;
  /**
   * Whether the device allows autoplay — false under reduced motion or data
   * saver (FeedCover.md:23). Suppressed, no clip starts on its own on any
   * surface (FeedCover.md:25): the election never hands the stage to anyone,
   * and only a play-disc tap puts a clip on it.
   */
  autoplayAllowed: boolean;
};

/**
 * Who holds the stage.
 *
 * In order:
 * - **Incumbency** (Feed.md:9/11/29). An incumbent that still holds keeps the
 *   stage; a clip entering view, one above re-qualifying, or an unveil changes
 *   nothing.
 * - **The hard top** (Feed.md:19/21) is the one boundary: landing there lapses
 *   the incumbent's claim — only while autoplay is allowed, and never over a
 *   clip the reader started by its play disc that still holds (Feed.md:23,
 *   FeedCover.md:31). Under suppression a landing does nothing.
 * - **Succession and the empty stage** (Feed.md:13/15/17). Otherwise the stage
 *   goes to the first qualifying clip in order — never the most visible —
 *   decided now, whatever the scroll is doing; under suppression to nobody.
 * - **Nothing qualifies, nothing plays.**
 */
export function elect<K>({
  incumbent,
  places,
  landedAtHardTop = false,
  autoplayAllowed,
}: ElectionInput<K>): K | null {
  const held = incumbent === null ? undefined : places.find((entry) => entry.key === incumbent);
  if (held !== undefined && holds(held.place)) {
    const lapses = landedAtHardTop && autoplayAllowed && !held.place.handStarted;
    if (!lapses) return incumbent;
  }
  if (!autoplayAllowed) return null;
  return places.find((entry) => qualifies(entry.place))?.key ?? null;
}

/**
 * The surface's order: DOM document order, which in a vertical list is the
 * list order, nested comment threads and side-by-side gallery pages included
 * (`Node.compareDocumentPosition`,
 * https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition).
 * A comparator for `Array.prototype.sort`.
 */
export function documentOrder(a: Node, b: Node): number {
  if (a === b) return 0;
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}
