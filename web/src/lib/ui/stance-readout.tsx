"use client";

// Two different numbers, and they are never merged into one line
// (design.md §8.2).
//
//   - "Where you stand now: …" sits ABOVE the readout. It is the bundle
//     as it stands.
//   - The FACE is the lossy readout of the edge being authored — this
//     pick, not the bundle it joins (§8.4). Conflating the two would make
//     the face mean something different depending on history, which is
//     exactly what a readout must not do. The EXACT PAIR sits with it and
//     is equally default: the face carries the feel and the pair carries
//     the fact, and hiding either makes the other harder to trust (§8.3).
//   - "This leaves you at: …" sits BELOW the field. It is the bundle
//     after the pick — the fold's answer, read from the backend and
//     rendered here. The control never derives it, and never decides for
//     itself whether a landing carries nothing: inertness and severance
//     arrive as flags on the read.
//
// Nothing sits under the knob: a thumb on the control covers exactly the
// spot where feedback would otherwise appear (§8.4). Both lines are
// `aria-live` so the same change reaches a reader who is not looking at
// the face.

import { nearestAnchor } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import type { StanceBundle, StanceLanding } from "@/lib/stance/stance-data";
import { formatStancePair, formatStanceWords } from "@/lib/ui/stance-format";

function face(pair: StancePair): string {
  const anchor = nearestAnchor(pair);
  return `${anchor.emoji} ${anchor.label}`;
}

/** The face, the words, and the exact pair — the default reading (§8.3). */
export function reading(pair: StancePair): string {
  return `${face(pair)} ${formatStancePair(pair)}`;
}

/** `undefined` while the standing is still being read, `null` where it could not be. */
export type BundleState = StanceBundle | null | undefined;

export function standingLine(bundle: BundleState, targetLabel: string): string {
  if (bundle === undefined) return "Checking where you stand…";
  if (bundle === null || bundle.records === 0) {
    return `You haven't taken a stance on ${targetLabel} yet.`;
  }
  if (bundle.severed) return `You've severed ${targetLabel}.`;
  // The folded pair rides along with the face: §8.3 makes the numbers
  // part of the default reading wherever the standing is shown.
  return `Where you stand now: ${reading(bundle.current)}`;
}

/**
 * The confirmation a signed gesture leaves (design.md §8.3; Android's
 * `stance_signed`). It names where the gesture LEFT the viewer, never
 * the pick that got them there — the pick is already behind them, and
 * the standing is what they now carry. "Still settling" is the honest
 * half: that standing is the pending-inclusive fold, counting a record
 * not yet on L1 (§9). The batch count rides along where there was one,
 * because the cost the reader agreed to is part of what completed.
 *
 * The axes are named rather than compacted: a transient surface is read
 * away from the pad that would otherwise say which number is which, so
 * it takes the same words Android's `stance_signed` is handed.
 */
export function signedLine(
  standing: StancePair,
  records: number,
  severed: boolean,
  targetLabel: string,
): string {
  const acts = records === 1 ? "Signed" : `Signed ${records} actions`;
  // Severance says itself; a pair at the origin would read as a stance
  // taken rather than one walked back.
  const where = severed
    ? `You've severed ${targetLabel}.`
    : `Where you stand now: ${formatStanceWords(standing)}`;
  return `${acts}, still settling. ${where}`;
}

/**
 * The landing, in the precedence Android fixes: severance first, then
 * inertness, then the ordinary reading. `null` is a landing not yet
 * known — it says so rather than showing a stale one.
 *
 * Which axis is inert is read off the landing the fold returned, and
 * only once the fold has DECLARED the landing inert. The schema carries
 * one `inert` flag ("either axis at zero") rather than one per axis, so
 * the flag decides that inertness applies and the returned pair only
 * says which side it fell on.
 */
export function landingLine(landing: StanceLanding | null): string {
  if (landing === null) return "Working out where this leaves you…";
  if (landing.severed) return "This pick nets everything you've said about it back to nothing.";
  if (landing.inert) {
    const directedInert = landing.landing.pDirected === 0;
    const interestInert = landing.landing.pInterest === 0;
    if (directedInert && interestInert) return "This would carry nothing.";
    if (directedInert) return "Where you stand would carry nothing.";
    if (interestInert) return "What reaches you would carry nothing.";
  }
  return `This leaves you at: ${face(landing.landing)}`;
}

/** The standing and the pick's face — everything that sits above the field. */
export function StanceStanding({
  pick,
  bundle,
  targetLabel,
  testIdPrefix,
}: {
  pick: StancePair;
  bundle: BundleState;
  targetLabel: string;
  testIdPrefix: string;
}) {
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      <p
        data-testid={`${testIdPrefix}-standing`}
        className="text-body-small text-on-surface-variant"
      >
        {standingLine(bundle, targetLabel)}
      </p>
      <p data-testid={`${testIdPrefix}-face`} className="text-title-large">
        {face(pick)}
      </p>
      {/* The numbers are part of the default reading, not an option
          (§8.3). The compact pair is what the eye tracks against the
          drag; the axes are named for a reader who has no field in front
          of them to say which number is which. */}
      <p data-testid={`${testIdPrefix}-exact`} className="text-body-small text-on-surface-variant">
        <span aria-hidden="true">{formatStancePair(pick)}</span>
        <span className="sr-only">{formatStanceWords(pick)}</span>
      </p>
    </div>
  );
}

/** The landing — the one line that sits below the field. */
export function StanceLandingLine({
  landing,
  testIdPrefix,
}: {
  /** The fold's projection of the pick; null while it is being read. */
  landing: StanceLanding | null;
  testIdPrefix: string;
}) {
  return (
    <p aria-live="polite" data-testid={`${testIdPrefix}-landing`} className="text-body-small">
      {landingLine(landing)}
    </p>
  );
}
