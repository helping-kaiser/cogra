// How the two parameters are named and how their values are written,
// shared by every surface that edits a stance so they all say the same
// thing (design.md §7; Android parity).
//
// design.md §7 keeps implementation vocabulary off the screen — "weight"
// and "parameter" are on its list by name — and edges.md §1 leaves the
// frontend free to surface whichever aspect fits the gesture.

import type { StancePair } from "@/lib/stance/model";

/** `p_d`. Neither "valence" nor "p_d" ever reaches the screen. */
export const DIRECTED_LABEL = "How you stand";
/** `p_i`. Neither "connection" nor "p_i" ever reaches the screen. */
export const INTEREST_LABEL = "In your world";

/**
 * What a record family calls the two slots it fills — the question each
 * axis asks, and the words at its two ends.
 *
 * The control owns the geometry, the record family owns the words
 * (copy-voice.md, "The vocabulary that stays off the screen"). One
 * gesture, one face table, one ceremony: an Affinity is not a second
 * kind of feeling, so nothing here restyles a pixel or moves a knob —
 * only the words at the edges belong to the family.
 *
 * The questions are carried as well as the ends because the ends alone
 * leave a slider labelled with the opinion's question (design/backlog
 * item 79, ruled 2026-09-15). They reach the sliders, the typed fields
 * and every spoken readout, so the accessible route asks what the drawn
 * one asks.
 */
export type StanceAxes = {
  /** What the `p_d` axis asks. */
  readonly directed: string;
  /** What the `p_i` axis asks. */
  readonly interest: string;
  readonly left: string;
  readonly right: string;
  readonly bottom: string;
  readonly top: string;
};

/** An opinion's own words — the default every surface had before families named theirs. */
export const STANCE_AXES: StanceAxes = {
  directed: DIRECTED_LABEL,
  left: "Against",
  right: "For",
  interest: INTEREST_LABEL,
  bottom: "Less",
  top: "More",
};

/**
 * An Affinity toward a Type — the gesture a topic's stance row wears
 * (copy-voice.md, "The Affinity pad's six words"; ruled 2026-09-15,
 * drawn on `TagPageHeldPad`). It fills the same two signed slots with
 * association and attraction (`layer1-interface.md` §9.5), and its ends
 * are neither the opinion's `Against / For`, which names a verdict this
 * record does not carry, nor its `Less / More`, which names reach rather
 * than closeness.
 */
export const AFFINITY_AXES: StanceAxes = {
  directed: "How much you like it",
  left: "Dislike",
  right: "Like",
  interest: "How close you want to be",
  bottom: "Far away",
  top: "Close to me",
};

/**
 * A dimension as the reader reads numbers: always signed, two decimals.
 * The sign is what carries the direction, so it is shown even at zero.
 */
export function formatDimension(value: number, locale?: string | readonly string[]): string {
  return new Intl.NumberFormat(locale as string | string[] | undefined, {
    signDisplay: "always",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * The exact pair, `+0.40 / +0.20`-style (design.md §8.3). It is part of
 * the DEFAULT reading: the face carries the feel and the pair carries the
 * fact, and hiding either makes the other harder to trust. Valence first,
 * matching the pad's own horizontal-then-vertical order.
 */
export function formatStancePair(
  pair: StancePair,
  locale?: string | readonly string[],
): string {
  return `${formatDimension(pair.pDirected, locale)} / ${formatDimension(pair.pInterest, locale)}`;
}

/**
 * The same two values with their axes named, for the surfaces that edit
 * one axis at a time (design.md §8.6) and for readers who meet the pair
 * without the pad's own layout to tell them which number is which.
 */
export function formatStanceWords(
  pair: StancePair,
  axes: StanceAxes = STANCE_AXES,
  locale?: string | readonly string[],
): string {
  return (
    `${axes.directed} ${formatDimension(pair.pDirected, locale)}, ` +
    `${axes.interest} ${formatDimension(pair.pInterest, locale)}`
  );
}
