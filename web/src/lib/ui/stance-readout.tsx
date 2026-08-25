"use client";

// Two different numbers, shown as two different lines (design.md §8.2).
//
//   - The FACE is the lossy readout of the edge being authored — this
//     pick, not the bundle it joins (§8.4). Conflating the two would make
//     the face mean something different depending on history, which is
//     exactly what a readout must not do.
//   - Where the pick LANDS the bundle is the fold's answer, read from the
//     backend and rendered here. The control never derives it.
//
// The readout sits above the pad, never under the knob: a thumb on the
// control covers exactly the spot where feedback would otherwise appear
// (§8.4). It is `aria-live` so the same change reaches a reader who is
// not looking at the face.

import { nearestAnchor } from "@/lib/stance/anchors";
import { formatPair, inertAxes, isSevered, type StancePair } from "@/lib/stance/model";
import type { StanceBundle } from "@/lib/stance/stance-data";

function face(pair: StancePair): string {
  const anchor = nearestAnchor(pair);
  return `${anchor.emoji} ${anchor.label}`;
}

/** `undefined` while the standing is still being read. */
export type BundleState = StanceBundle | null | undefined;

function standingLine(bundle: BundleState, targetLabel: string): string {
  if (bundle === undefined) return "Checking where you stand…";
  if (bundle === null) return `You haven't taken a stance on ${targetLabel} yet.`;
  if (isSevered(bundle.current) && bundle.severance.records === 0) {
    return `You've cut off ${targetLabel}.`;
  }
  return `Right now: ${face(bundle.current)}`;
}

function landingLine(projection: StancePair | null): string | null {
  if (projection === null) return null;
  if (isSevered(projection)) return "This would end your standing entirely.";
  const inert = inertAxes(projection);
  if (inert.directed && !inert.interest) {
    return `Lands you at ${face(projection)} — where you stand would carry nothing.`;
  }
  if (inert.interest && !inert.directed) {
    return `Lands you at ${face(projection)} — how much you see would carry nothing.`;
  }
  return `Lands you at ${face(projection)}`;
}

export function StanceReadout({
  pick,
  bundle,
  projection,
  targetLabel,
  showExact = false,
  testIdPrefix,
}: {
  pick: StancePair;
  bundle: BundleState;
  /** The fold's projection of `pick`; null while it is being read. */
  projection: StancePair | null;
  targetLabel: string;
  /** Exact values stay available, but are never the default reading (§8.3). */
  showExact?: boolean;
  testIdPrefix: string;
}) {
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      <p data-testid={`${testIdPrefix}-face`} className="text-title-large">
        {face(pick)}
      </p>
      <p
        data-testid={`${testIdPrefix}-standing`}
        className="text-body-small text-on-surface-variant"
      >
        {standingLine(bundle, targetLabel)}
      </p>
      {landingLine(projection) !== null && (
        <p data-testid={`${testIdPrefix}-landing`} className="text-body-small">
          {landingLine(projection)}
        </p>
      )}
      {showExact && (
        <p
          data-testid={`${testIdPrefix}-exact`}
          className="text-body-small text-on-surface-variant"
        >
          {formatPair(pick)}
        </p>
      )}
    </div>
  );
}
