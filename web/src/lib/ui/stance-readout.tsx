"use client";

// Two different numbers, and they are never merged into one line
// (design.md §8.2).
//
//   - "Where you stand now: …" sits ABOVE the readout. It is the bundle
//     as it stands.
//   - The FACE is the lossy readout of the edge being authored — this
//     pick, not the bundle it joins (§8.4). Conflating the two would make
//     the face mean something different depending on history, which is
//     exactly what a readout must not do.
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
import { formatStanceWords } from "@/lib/ui/stance-format";

function face(pair: StancePair): string {
  const anchor = nearestAnchor(pair);
  return `${anchor.emoji} ${anchor.label}`;
}

/** `undefined` while the standing is still being read, `null` where it could not be. */
export type BundleState = StanceBundle | null | undefined;

/** Nothing to show: never stanced, or a standing this session could not read. */
export function noStanding(bundle: BundleState): boolean {
  return bundle === null || bundle === undefined || bundle.records === 0;
}

export function standingLine(bundle: BundleState, targetLabel: string): string {
  if (bundle === undefined) return "Checking where you stand…";
  if (bundle === null || bundle.records === 0) {
    return `You haven't taken a stance on ${targetLabel} yet.`;
  }
  if (bundle.severed) return `You've severed ${targetLabel}.`;
  return `Where you stand now: ${face(bundle.current)}`;
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
  showExact = false,
  testIdPrefix,
}: {
  pick: StancePair;
  bundle: BundleState;
  targetLabel: string;
  /** Exact values stay available, but are never the default reading (§8.3). */
  showExact?: boolean;
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
      {showExact && (
        <p
          data-testid={`${testIdPrefix}-exact`}
          className="text-body-small text-on-surface-variant"
        >
          {formatStanceWords(pick)}
        </p>
      )}
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
