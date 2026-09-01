import React from "react";

/* The stance readout — the numbers and the faces (design.md §8.2, §8.3, §8.4).

   TWO DIFFERENT NUMBERS, NEVER MERGED INTO ONE LINE:
     · "Current stance" sits ABOVE the readout — the bundle as it stands.
     · The FACE is the lossy readout of the EDGE BEING AUTHORED — this pick, not
       the bundle it joins. Conflating the two would make the face mean something
       different depending on history, which is exactly what a readout must not do.
       The EXACT PAIR sits with it and is equally default: the face carries the
       feel and the pair carries the fact, and hiding either makes the other harder
       to trust.
     · "Resulting stance" sits BELOW the field — the bundle after the pick.

   DIVERGENCE FROM THE SOURCE: the anchor's WORDS ARE NO LONGER DRAWN. The source
   renders face + words + pair — three encodings of one value, which is two too
   many. The words are the redundant one: the face carries the feel and the pair
   carries the fact exactly.

   THE WORDS STILL EXIST, in the accessibility tree, and this must not become
   "colour carries meaning alone" (§10). An emoji's own accessible name is
   "slightly smiling face", never "Like this", so dropping the label from the DOM
   entirely would take the meaning from exactly the readers §10 protects. Every
   visible readout therefore pairs an `aria-hidden` visual with a
   screen-reader-only reading that names the stance and its axes.

   Nothing sits under the knob: a thumb on the control covers exactly the spot
   where feedback would otherwise appear. Both lines are `aria-live`.

   The anchor table IS THE CONTRACT — both clients read these twenty values, and a
   change here changes both apps. They are deliberately dense in the
   for-it-and-want-it quadrant, where most real stances land and small differences
   matter, and sparse at the extremes. */

export const DIMENSION_MIN = -1;
export const DIMENSION_MAX = 1;
export const ORIGIN = { pDirected: 0, pInterest: 0 };
/** What a plain tap commits — the repo-wide low-defaults policy. */
export const TAP_DEFAULT = { pDirected: 0.1, pInterest: 0.1 };

/** `p_d`. Neither "valence" nor "p_d" ever reaches the screen. */
export const DIRECTED_LABEL = "For or against";
/** `p_i`. Neither "connection" nor "p_i" ever reaches the screen. */
export const INTEREST_LABEL = "How much reaches you";
/** The ends of each axis, named. A slider from −1 to +1 needs its poles said. */
export const DIRECTED_POLES = ["Against", "For"];
export const INTEREST_POLES = ["Less", "More"];
/** What the middle pair is: the edge being authored, not the standing. */
export const PICK_LABEL = "Your pick";

export const SEVERED_LABEL = "Severed";
export const NO_STANDING_LABEL = "No stance yet";
/** What a bundle standing at exactly (0, 0) reads as. */
export const ZERO_BUNDLE_EMOJI = "🤷";
/** The face an unauthored target wears at rest — deliberately outside the table. */
export const RESTING_FACE_EMOJI = "😐";

/** Visually hidden, still read aloud — where the anchors' words now live. */
export const SR_ONLY = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export const STANCE_ANCHORS = [
  { pDirected: 0.15, pInterest: 0.15, emoji: "🙂", label: "Nice" },
  { pDirected: 0.55, pInterest: 0.2, emoji: "😊", label: "Like this" },
  { pDirected: 0.9, pInterest: 0.25, emoji: "😍", label: "Love this" },
  { pDirected: 0.2, pInterest: 0.6, emoji: "👀", label: "Show me more" },
  { pDirected: 0.6, pInterest: 0.65, emoji: "🤩", label: "Really into this" },
  { pDirected: 0.25, pInterest: 0.95, emoji: "🍿", label: "Tell me everything" },
  { pDirected: 0.95, pInterest: 0.9, emoji: "🔥", label: "All in" },
  { pDirected: -0.15, pInterest: 0.15, emoji: "😕", label: "Not for me" },
  { pDirected: -0.55, pInterest: 0.25, emoji: "🙁", label: "Don't like this" },
  { pDirected: -0.9, pInterest: 0.3, emoji: "😠", label: "Really against this" },
  { pDirected: -0.45, pInterest: 0.75, emoji: "😤", label: "Against, but keep me posted" },
  { pDirected: -0.9, pInterest: 0.9, emoji: "🤬", label: "Against, and I want all of it" },
  { pDirected: 0.2, pInterest: -0.2, emoji: "😶", label: "Fine, just not for me" },
  { pDirected: 0.7, pInterest: -0.3, emoji: "😌", label: "Good, but not in my world" },
  { pDirected: 0.3, pInterest: -0.8, emoji: "🙈", label: "Rather not see this" },
  { pDirected: 0.9, pInterest: -0.85, emoji: "🤐", label: "Good, keep it away" },
  { pDirected: -0.2, pInterest: -0.2, emoji: "😑", label: "Meh" },
  { pDirected: -0.6, pInterest: -0.45, emoji: "😖", label: "Dislike, keep away" },
  { pDirected: -0.35, pInterest: -0.85, emoji: "🚫", label: "Keep this away" },
  { pDirected: -0.9, pInterest: -0.9, emoji: "💀", label: "Absolutely not" },
];

export function clampDimension(value) {
  if (Number.isNaN(value)) return 0;
  const bounded = Math.min(DIMENSION_MAX, Math.max(DIMENSION_MIN, value));
  return bounded === 0 ? 0 : bounded;
}

export function clampPair(pair) {
  return { pDirected: clampDimension(pair.pDirected), pInterest: clampDimension(pair.pInterest) };
}

/** The nearest anchor by Euclidean distance; the first of an exact tie wins. */
export function nearestAnchor(pair) {
  let best = STANCE_ANCHORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of STANCE_ANCHORS) {
    const dd = anchor.pDirected - pair.pDirected;
    const di = anchor.pInterest - pair.pInterest;
    const distance = dd * dd + di * di;
    if (distance < bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}

/** The readout a STANDING wears. The table never speaks for zero. */
export function bundleReadout(pair, zeroLabel = SEVERED_LABEL) {
  if (pair.pDirected === 0 && pair.pInterest === 0) return { emoji: ZERO_BUNDLE_EMOJI, label: zeroLabel };
  return nearestAnchor(pair);
}

/* The read-only value readout (profile round, 2026-09-01): a stance RECORD's
   face and pair drawn plainly wherever a stance is data rather than a control
   — the stances page's rows, the chronicle's stance entries. Never
   interactive: acting on a person means opening their profile first (jakob —
   stancing here is more deliberate than a follow). */
export function StanceValue({ pDirected, pInterest, showPair = true }) {
  const pair = { pDirected, pInterest };
  const readout = bundleReadout(pair);
  return (
    <span
      role="img"
      aria-label={`${readout.label}, ${formatStancePair(pair)}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <span aria-hidden="true" style={{ fontSize: "var(--text-title-medium)" }}>{readout.emoji}</span>
      {showPair && (
        <span aria-hidden="true" style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {formatStancePair(pair)}
        </span>
      )}
    </span>
  );
}

/** Always signed, two decimals. The sign carries the direction, so it shows at zero. */
export function formatDimension(value) {
  return new Intl.NumberFormat(undefined, {
    signDisplay: "always",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** `+0.40 / +0.20`-style. Valence first, matching the pad's horizontal-then-vertical order. */
export function formatStancePair(pair) {
  return `${formatDimension(pair.pDirected)} / ${formatDimension(pair.pInterest)}`;
}

/** The same two values with their axes named, for surfaces without the pad's layout. */
export function formatStanceWords(pair) {
  return `${DIRECTED_LABEL} ${formatDimension(pair.pDirected)}, ${INTEREST_LABEL} ${formatDimension(pair.pInterest)}`;
}

/** Where a pick lands the bundle: `clip` of RAW SUM plus pick, folded locally. */
export function localLanding(rawSum, pick) {
  const landing = clampPair({
    pDirected: rawSum.pDirected + pick.pDirected,
    pInterest: rawSum.pInterest + pick.pInterest,
  });
  return {
    landing,
    inert: landing.pDirected === 0 || landing.pInterest === 0,
    severed: landing.pDirected === 0 && landing.pInterest === 0,
  };
}

export function standingLine(bundle, targetLabel) {
  if (bundle === undefined) return "Checking your current stance…";
  if (bundle === null || bundle.records === 0) return `${ZERO_BUNDLE_EMOJI} No stance on ${targetLabel} yet.`;
  if (bundle.severed) return `${ZERO_BUNDLE_EMOJI} You've severed ${targetLabel}.`;
  // Face and pair; the words ride the spoken line beside it.
  return `Current stance ${bundleReadout(bundle.current).emoji} ${formatStancePair(bundle.current)}`;
}

/**
 * The severance read, split so the two numbers can be introduced in an order that
 * makes sense.
 *
 * The raw sum LEADS and the fold is derived from it. Stating the fold first and
 * the raw sum second reads as arithmetic that does not work — "my stance is +1.00,
 * so why does walking back take 1.40?" — because it presents the capped number as
 * the thing that exists and the true total as a correction to it. The total is
 * what the reader built up; the cap is what the feed reads of it. In that order it
 * explains itself, and §8.3's "clipped is not hidden" is honoured without
 * confusing anyone.
 *
 * `capped` is false when the sum never reached the clip, and then there is only
 * one number to show and no aside to make.
 */
export function severanceParts(bundle, targetLabel) {
  if (bundle === undefined) return { sentence: "Checking your current stance…" };
  if (bundle === null || bundle.records === 0) {
    return { sentence: `${ZERO_BUNDLE_EMOJI} No stance on ${targetLabel} yet.` };
  }
  const raw = formatStancePair(bundle.rawSum);
  const folded = formatStancePair(bundle.current);
  return { raw, folded, capped: raw !== folded };
}

export function landingLine(landing) {
  if (landing === null || landing === undefined) return "Working out the resulting stance…";
  if (landing.severed) return "Resulting stance: nothing — this nets everything you've said about it back to zero.";
  if (landing.inert) {
    const directedInert = landing.landing.pDirected === 0;
    const interestInert = landing.landing.pInterest === 0;
    if (directedInert && interestInert) return "Resulting stance: carries nothing.";
    if (directedInert) return "Resulting stance: your side of it carries nothing.";
    if (interestInert) return "Resulting stance: what reaches you carries nothing.";
  }
  const readout = bundleReadout(landing.landing);
  return `Resulting stance ${readout.emoji} ${formatStancePair(landing.landing)}`;
}

/** The confirmation a signed gesture leaves. Names where it LEFT the viewer.
    A transient surface is read away from the pad, so the words stay here: this
    line IS the accessible text, with no visual redundancy to carry them. */
export function signedLine(standing, records, severed, targetLabel) {
  const acts = records === 1 ? "Signed" : `Signed ${records} actions`;
  const where = severed
    ? `You've severed ${targetLabel}.`
    : `Current stance: ${bundleReadout(standing).label}, ${formatStanceWords(standing)}`;
  return `${acts}, still settling. ${where}`;
}

/** Face and pair, and the words for a reader who cannot see the face (§8.3). */
export function StanceReadout({ pair, kind = "pick", zeroLabel = SEVERED_LABEL, style }) {
  const readout = kind === "standing" ? bundleReadout(pair, zeroLabel) : nearestAnchor(pair);
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)", flex: "none", ...style }}>
      <span aria-hidden="true">{readout.emoji}</span>
      {/* NEVER WRAPS. This sits in the post card's affordance row, which is one
          line by rule — a pair broken across two text lines reads as a two-line
          block even when the row height has not changed. */}
      <span aria-hidden="true" style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
        {formatStancePair(pair)}
      </span>
      <span style={SR_ONLY}>{`${readout.label}, ${formatStanceWords(pair)}`}</span>
    </span>
  );
}

/** The standing, split for rendering: either a sentence, or a readout to lay out. */
export function standingParts(bundle, targetLabel) {
  if (bundle === undefined) return { sentence: "Checking your current stance…" };
  if (bundle === null || bundle.records === 0) return { sentence: `${ZERO_BUNDLE_EMOJI} No stance on ${targetLabel} yet.` };
  if (bundle.severed) return { sentence: `${ZERO_BUNDLE_EMOJI} You've severed ${targetLabel}.` };
  const readout = bundleReadout(bundle.current);
  return {
    label: "Current stance",
    emoji: readout.emoji,
    pair: formatStancePair(bundle.current),
    spoken: `Current stance: ${readout.label}, ${formatStanceWords(bundle.current)}`,
  };
}

/** The landing, split the same way. */
export function landingParts(landing) {
  if (landing === null || landing === undefined) return { sentence: "Working out the resulting stance…" };
  if (landing.severed || landing.inert) return { sentence: landingLine(landing) };
  const readout = bundleReadout(landing.landing);
  return {
    label: "Resulting stance",
    emoji: readout.emoji,
    pair: formatStancePair(landing.landing),
    spoken: `Resulting stance: ${readout.label}, ${formatStanceWords(landing.landing)}`,
  };
}

/* One labelled readout: the name of the quantity, then the face and the numbers on
   the line below it. Three of these stack in the pad — current stance, the pick,
   the resulting stance — and they are formatted identically so the eye can compare
   them without reading. */
function ReadoutBlock({ label, emoji, pair, spoken, sentence, big = false, style }) {
  if (sentence !== undefined) {
    return (
      <p style={{ margin: 0, fontSize: "var(--text-body-small)", color: "var(--text-secondary)", ...style }}>{sentence}</p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", ...style }}>
      <span
        aria-hidden="true"
        style={{
          fontSize: "var(--text-label-small)",
          letterSpacing: "var(--text-label-small--letter-spacing)",
          fontWeight: "var(--text-label-small--font-weight)",
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </span>
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span style={{ fontSize: big ? "var(--text-title-large)" : "var(--text-title-medium)", lineHeight: 1.2 }}>{emoji}</span>
        <span style={{ fontSize: "var(--text-body-small)", color: big ? "var(--on-surface)" : "var(--text-secondary)", whiteSpace: "nowrap" }}>{pair}</span>
      </span>
      <span style={SR_ONLY}>{spoken}</span>
    </div>
  );
}

/** The standing and the pick — everything that sits above the field. */
export function StanceStanding({ pick, bundle, targetLabel, style }) {
  const anchor = nearestAnchor(pick);
  return (
    <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", ...style }}>
      <ReadoutBlock {...standingParts(bundle, targetLabel)} />
      {/* The pick's own readout — above the field, never under the knob, because a
          thumb on the control covers exactly where feedback would otherwise sit. */}
      <ReadoutBlock
        big
        label={PICK_LABEL}
        emoji={anchor.emoji}
        pair={formatStancePair(pick)}
        spoken={`${PICK_LABEL}: ${anchor.label}, ${formatStanceWords(pick)}`}
      />
    </div>
  );
}

/** The landing — the one readout that sits below the field. */
export function StanceLandingLine({ landing, style }) {
  return (
    <div aria-live="polite" style={style}>
      <ReadoutBlock {...landingParts(landing)} />
    </div>
  );
}
