"use client";

// THE BACKING AN AUTHOR SIGNS WITH THEIR OWN CONTENT IS ONE NUMBER (jakob
// 2026-10-16, PR-101) — the masters `AttachmentReadout`, `AttachmentStanding`
// and `AttachmentLandingLine` (`design/components/stance/StanceReadout.jsx`).
//
// Publish is a single-parameter family: `p_d` is the author's attachment,
// their BACKING, and `p_i` is pinned at 1 by the census, so a pair would draw
// a second figure nobody can choose. The face comes from `VALENCE_SIX` (🤷 at
// exactly 0.00, spoken `Nothing`), and the spoken twin names the one axis
// there is. The author's OPINION on their own post is a different record — the
// ordinary pair its face takes — read by the stance readouts like any other.
//
// The visuals are `aria-hidden` and the reading is spoken beside them: an
// emoji's own accessible name is "slightly smiling face", never "Nice".

import { useEffect, useState } from "react";

import {
  attachmentLanding,
  BACKING_AFTER_LABEL,
  backingNet,
  CURRENT_BACKING_LABEL,
} from "@/lib/stance/backing";
import { nearestValenceAnchor, PICK_LABEL, VALENCE_LABEL } from "@/lib/stance/valence";
import { formatDimension } from "@/lib/ui/stance-format";

/**
 * SERVER GAP PLACEHOLDER — not drawn copy. What a backing readout shows while
 * no read serves the author's Publish bundle toward their own post (see
 * `fetchPostBacking`). It stands where the drawn face and number would, so the
 * gap is visible on the hand test instead of hidden behind a guessed value.
 */
export const BACKING_UNREAD = "Not readable yet";

/** The one-axis reading in words — `Nice, For or against +0.10`. */
export function attachmentWords(pDirected: number): string {
  return `${nearestValenceAnchor(pDirected).label}, ${VALENCE_LABEL} ${formatDimension(pDirected)}`;
}

/** A labelled readout's spoken line — `Your pick: Nice, For or against +0.10`. */
export function backingBlockWords(label: string, value: number): string {
  return `${label}: ${attachmentWords(value)}`;
}

/** The settle the readouts speak after (the master's `SETTLE_MS`). */
export const SETTLE_MS = 500;

/**
 * What the readouts say aloud: the value once it has stopped changing for
 * `SETTLE_MS`. The first paint says the value as it stands; only a run of
 * changes under a dragging thumb is held back until it rests.
 */
function useSettled(value: string, ms = SETTLE_MS): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (value === settled) return undefined;
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, settled, ms]);
  return settled;
}

/**
 * The face and the one number, as a settings row reads them back — the seal's
 * and the edit's `Your backing` row.
 */
export function AttachmentReadout({ pDirected, testId }: { pDirected: number; testId: string }) {
  const band = nearestValenceAnchor(pDirected);
  return (
    <span className="inline-flex flex-none items-baseline gap-2" data-testid={testId}>
      <span aria-hidden="true">{band.emoji}</span>
      <span aria-hidden="true" className="whitespace-nowrap text-body-small text-on-surface-variant">
        {formatDimension(pDirected)}
      </span>
      <span className="sr-only">{attachmentWords(pDirected)}</span>
    </span>
  );
}

/**
 * One labelled readout: the name of the quantity, then the face and the number
 * on the line below it — formatted identically for all three, so the eye can
 * compare them without reading. `value` null is the server gap's placeholder.
 */
function ReadoutBlock({
  label,
  value,
  big = false,
  testId,
}: {
  label: string;
  value: number | null;
  big?: boolean;
  testId: string;
}) {
  const said = useSettled(value === null ? `${label}: ${BACKING_UNREAD}` : backingBlockWords(label, value));
  const band = value === null ? null : nearestValenceAnchor(value);
  return (
    <div className="flex flex-col" data-testid={testId}>
      <span aria-hidden="true" className="text-label-small text-on-surface-variant">
        {label}
      </span>
      {band === null || value === null ? (
        <span aria-hidden="true" data-testid={`${testId}-unread`} className="text-body-small text-on-surface-variant">
          {BACKING_UNREAD}
        </span>
      ) : (
        <span aria-hidden="true" className="inline-flex items-baseline gap-2">
          <span data-testid={`${testId}-face`} className={big ? "text-title-large" : "text-title-medium"}>
            {band.emoji}
          </span>
          <span
            data-testid={`${testId}-exact`}
            className={`whitespace-nowrap text-body-small ${big ? "text-on-surface" : "text-on-surface-variant"}`}
          >
            {formatDimension(value)}
          </span>
        </span>
      )}
      <span className="sr-only">{said}</span>
    </div>
  );
}

/**
 * Everything above the strip. At compose nothing is standing, so the pick is
 * its own result and `Your pick` reads alone (`current` undefined). An edit
 * reads `Current backing` — the bundle's net — over `Your pick`; `rawSum` null
 * is the server gap, read as the placeholder.
 */
export function AttachmentStanding({
  pick,
  rawSum,
  testIdPrefix,
}: {
  pick: number;
  /** The bundle's raw sum at an edit; null while unread; undefined at compose. */
  rawSum?: number | null;
  testIdPrefix: string;
}) {
  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {rawSum !== undefined && (
        <ReadoutBlock
          label={CURRENT_BACKING_LABEL}
          value={rawSum === null ? null : backingNet(rawSum)}
          testId={`${testIdPrefix}-current`}
        />
      )}
      <ReadoutBlock big label={PICK_LABEL} value={pick} testId={`${testIdPrefix}-pick`} />
    </div>
  );
}

/**
 * Where the pick lands the backing — beneath an edit's strip. `clip` of the
 * RAW sum plus the pick, and past the cap a quiet line states the total and
 * the cap (*Two numbers, never one*).
 */
export function AttachmentLandingLine({
  rawSum,
  pick,
  testIdPrefix,
}: {
  /** Null while no read serves the bundle — the server gap's placeholder. */
  rawSum: number | null;
  pick: number;
  testIdPrefix: string;
}) {
  const after = rawSum === null ? null : attachmentLanding(rawSum, pick);
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      <ReadoutBlock
        label={BACKING_AFTER_LABEL}
        value={after === null ? null : after.landing}
        testId={`${testIdPrefix}-after`}
      />
      {after !== null && after.capped && (
        <p data-testid={`${testIdPrefix}-cap`} className="m-0 text-body-small text-on-surface-variant">
          {`Adds up to ${formatDimension(after.raw)}; your feed reads it capped at ${formatDimension(after.landing)}.`}
        </p>
      )}
    </div>
  );
}
