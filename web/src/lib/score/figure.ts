// THE FEED SCORE AS IT IS WRITTEN (copy-voice, *The score drill-down*;
// readme §13, "The Feed score"; ExplainableNumber.prompt.md).
//
// - Two decimals, uncapped, never normalised: the ranker's own figure.
// - A card keeps its PLAIN figure — `15.20` — and a negative keeps its `−`
//   everywhere, a zero none. The sign appears only on the trace's flag:
//   `+15.20` (copy-voice: "every card keeps its plain figure").
// - THE DASH IS NO COMPUTED FIGURE (FeedKinds.md:15; FeedEntryMoved.md:5):
//   never `0.00`, which is severance's alone.
//
// THE ARITHMETIC CLOSES ON THE DRAWN SURFACE (FeedEntry.md:15; SR-G8's build
// reading). Rounding each path on its own lets the drawn rows miss the flag
// by a cent, and a reader who adds them would find the one hole the trace
// promises is not there. So the displayed parts are apportioned by largest
// remainder: each stays within 0.01 of its exact value, and they sum exactly
// to the displayed flag. This is a rendering of the ranker's numbers, never
// a second computation of them — nothing here is claimed as the ranker's.

/** The minus the house writes (copy-voice: "a negative keeping its `−`"). */
const MINUS = "−";

/** The figure that is not computed (FeedEntryMoved.md:5). */
export const DASH = "—";

/** Rounds half away from zero, so a figure and its negation round alike. */
function roundCents(value: number): number {
  const cents = Math.round(Math.abs(value) * 100);
  return value < 0 ? -cents : cents;
}

function digits(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const part = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${whole}.${part}`;
}

/** A card's figure: plain, a negative wearing `−`, a zero none. */
export function cardFigureOfCents(cents: number): string {
  return cents < 0 ? `${MINUS}${digits(cents)}` : digits(cents);
}

/** A card's figure from the ranker's exact score. */
export function cardFigure(score: number): string {
  return cardFigureOfCents(roundCents(score));
}

/** A signed figure — the trace's flag and every path's value: `+6.80`, `−0.50`, `0.00`. */
export function signedOfCents(cents: number): string {
  if (cents === 0) return digits(0);
  return cents > 0 ? `+${digits(cents)}` : `${MINUS}${digits(cents)}`;
}

/** The trace's flag: the signed figure, or the dash where none was computed. */
export function flagFigure(score: number | null): string {
  return score === null ? DASH : signedOfCents(roundCents(score));
}

/**
 * Largest-remainder apportionment (SR-G8): `parts` in whole cents that sum to
 * the displayed `total`, each within one cent of its exact value whenever the
 * exact parts add up to the total (the trace's own law: "their contributions
 * add up to it", `FeedTrace.paths`).
 */
export function apportionCents(parts: readonly number[], total: number): number[] {
  if (parts.length === 0) return [];
  const target = roundCents(total);
  const scaled = parts.map((part) => part * 100);
  const cents = scaled.map((value) => Math.floor(value));
  let rest = target - cents.reduce((sum, value) => sum + value, 0);
  // Largest fractional part first; a tie keeps the extraction order.
  const order = scaled
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let at = 0; rest > 0; at = (at + 1) % order.length, rest -= 1) {
    const index = order[at]!.index;
    cents[index] = cents[index]! + 1;
  }
  // Only reachable when the exact parts overshoot the total (an answer that
  // breaks its own add-up law): the smallest fractions give a cent back.
  for (let at = order.length - 1; rest < 0; at = (at - 1 + order.length) % order.length, rest += 1) {
    const index = order[at]!.index;
    cents[index] = cents[index]! - 1;
  }
  return cents;
}
