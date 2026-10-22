// How the two parameters are named and how their values are written,
// shared by every surface that edits a stance so they all say the same
// thing (design.md §7; Android parity).
//
// design.md §7 keeps implementation vocabulary off the screen — "weight"
// and "parameter" are on its list by name — and edges.md §1 leaves the
// frontend free to surface whichever aspect fits the gesture.

import type { StancePair } from "@/lib/stance/model";

/**
 * `p_d`. Neither "valence" nor "p_d" ever reaches the screen
 * (`StanceReadout.jsx`'s `DIRECTED_LABEL`; readme §11, "The axes are renamed").
 */
export const DIRECTED_LABEL = "For or against";
/** `p_i`. Neither "connection" nor "p_i" ever reaches the screen. */
export const INTEREST_LABEL = "How much reaches you";

/**
 * THE WAY OUT IS THE FAMILY'S WORD TOO (`StanceReadout.jsx`'s
 * `STANCE_SEVERANCE_WORDS`, jakob 2026-09-15). A person, a post and a comment
 * are walked back; a topic is disconnected from (`AFFINITY_SEVERANCE`). The
 * sentences are functions of what they name, so one object serves every
 * target of its family.
 */
export type SeveranceWords = {
  /** The pad's standing control, and the confirming button in its dialog. */
  readonly control: string;
  /** The confirming button's label while its signing is in flight. */
  readonly busy: string;
  readonly title: (targetLabel: string) => string;
  readonly effect: (targetLabel: string) => string;
  readonly sum: (targetLabel: string, total: string) => string;
  /** How a bundle already at nothing reads, wherever it is read as a sentence. */
  readonly gone: (targetLabel: string) => string;
  /** The same fact as a LABEL, beside a face, where no sentence fits. */
  readonly zero: string;
  /** What the pad says a pick of (0, 0) would do. */
  readonly landing: string;
  /** The pad help's fourth line. */
  readonly help: string;
  /** The alternates help's fourth line. */
  readonly helpAlternates: string;
};

export const STANCE_SEVERANCE_WORDS: SeveranceWords = {
  control: "Walk it back",
  busy: "Walking it back…",
  title: () => "Walk it all back?",
  effect: (targetLabel) =>
    `Your opinion of ${targetLabel} drops to nothing. It stops reaching your feed, you stop earning from it, and nothing passes on through you.`,
  sum: (targetLabel, total) =>
    `Everything you've said about ${targetLabel} adds up to ${total}, and that is what this walks back.`,
  gone: (targetLabel) => `You've walked ${targetLabel} back to nothing.`,
  zero: "Walked back",
  landing: "This takes you back to zero.",
  help: "Walk it back takes everything you've said to nothing. It has its own confirmation, and each thing you've said is walked back by its own signature.",
  helpAlternates:
    "Walk it back takes everything to nothing, and each thing you've said is walked back by its own signature.",
};

/** The topic family's way out (`_shared.jsx`'s `AFFINITY_SEVERANCE`). */
export const AFFINITY_SEVERANCE: SeveranceWords = {
  control: "Disconnect",
  busy: "Disconnecting…",
  title: (name) => `Disconnect from ${name}?`,
  effect: (name) =>
    `You end up with no opinion towards ${name}. It stops reaching your feed, you stop earning from it, and nothing passes on through you.`,
  sum: (name, total) =>
    `Everything you've said about ${name} adds up to ${total}, and disconnecting clears all of it.`,
  gone: (name) => `No opinion towards ${name}.`,
  zero: "No opinion",
  landing: "This leaves you with no opinion towards it.",
  help: "Disconnect takes everything you've said about the topic to nothing. It has its own confirmation, and each thing you've said is cleared by its own signature.",
  helpAlternates:
    "Disconnect takes everything to nothing, and each thing you've said is cleared by its own signature.",
};

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
  /** The family's own way out; absent, the person family's (`severanceWords`). */
  readonly severance?: SeveranceWords;
};

/** A family's severance words, or the default family's. */
export function severanceWords(axes?: StanceAxes): SeveranceWords {
  return axes?.severance ?? STANCE_SEVERANCE_WORDS;
}

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
  severance: AFFINITY_SEVERANCE,
};

/**
 * THE MINUS IS U+2212, NOT A HYPHEN (`StanceReadout.jsx`; readme §3,
 * *Numbers*): MINUS SIGN pairs with `+` — it carries the plus's width and sits
 * on its optical axis — where U+002D is a narrow dash set for word-joining. It
 * is substituted BY PART, through `formatToParts`, so the swap touches the
 * sign and can never reach a digit or a separator.
 */
const MINUS_SIGN = "−";

/**
 * A dimension as the reader reads numbers: always signed, two decimals,
 * `en-US` like the master — the system's one number format, the same on
 * every browser. The sign is what carries the direction, so it is shown even
 * at zero.
 */
export function formatDimension(value: number, locale: string | readonly string[] = "en-US"): string {
  return new Intl.NumberFormat(locale as string | string[], {
    signDisplay: "always",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(value)
    .map((part) => (part.type === "minusSign" ? MINUS_SIGN : part.value))
    .join("");
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
