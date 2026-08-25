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
  locale?: string | readonly string[],
): string {
  return (
    `${DIRECTED_LABEL} ${formatDimension(pair.pDirected, locale)}, ` +
    `${INTEREST_LABEL} ${formatDimension(pair.pInterest, locale)}`
  );
}
