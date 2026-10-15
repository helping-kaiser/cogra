"use client";

// THE COMPOSER'S PAIR SHEETS — `TagPadCompose` (a staged tag's pair) and
// `RefPair` (a staged citation's pair), design/designs/canonical/screens/
// TagPadCompose.jsx and RefPair.jsx, with their behaviour sidecars.
//
// ONE SHEET, TWO FAMILIES. The two boards are the same gesture on the same
// kind of surface — a sheet titled by the thing it edits, the pick's readout
// above a two-axis field, `Done` at the foot — and differ only in what the
// census gives each family: a tag's relevance floors at +0.01 and its
// confidence runs 0 to 1, read through the tag's own thirteen objects with
// their words; a citation's two slots are both signed, read through the stance
// faces WITHOUT the anchor's word, because that word names a feeling about a
// stance and a citation is not one.
//
// `Done` COMMITS, EVERY OTHER WAY OUT KEEPS NOTHING — the scrim, a swipe down,
// Back and Escape alike (the sheet law, readme §4). So the sheet holds its own
// staged copy of the pair from the moment it opens, hands it out only on Done,
// and drops it on every other close: the host's state is touched once or not
// at all. Nothing signs here either; the pair rides the staged tag or citation
// and the seal signs the batch.
//
// THE FIELD HAS A NON-DRAG ROUTE (audit K10.1): `Set exact values for …` is the
// sheet's first control, visually hidden until focused — the skip-link idiom
// `StanceControl` already uses — and focus lands on it when the sheet opens. It
// swaps the field, in place, for the two tracks with the family's names, poles
// and reach, `Type exact values` one tap away (`StanceAlternates` at
// `host="sheet"`); the readout and `Done` stay. The readout is `aria-live`, so a
// track or a typed value that moves the pair is heard as well as seen.

import { useId, useRef, useState } from "react";

import { nearestAnchor } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import {
  clampToRanges,
  STANCE_RANGES,
  TAG_RANGES,
  type AxisRange,
  type PadRanges,
} from "@/lib/stance/pad-geometry";
import { nearestTagAnchor } from "@/lib/topics/anchors";
import { buttonClassName } from "@/lib/ui/button";
import { formatDimension, formatStancePair, type StanceAxes } from "@/lib/ui/stance-format";
import { formatConfidence, formatTagPair } from "@/lib/ui/tag-format";

import { BottomSheet } from "../bottom-sheet";
import { PillButton } from "../pill-button";
import { PairField } from "./pair-field";

/** A tag's poles and questions (`TagPadCompose.jsx`'s `TAG_AXES`). */
export const TAG_PAIR_AXES: StanceAxes = {
  directed: "How much it is about this",
  interest: "How sure you are",
  left: "Barely",
  right: "Entirely",
  bottom: "Guessing",
  top: "Certain",
};

/** A citation's poles and questions (`RefPair.jsx`'s `CITATION_AXES`). */
export const CITATION_PAIR_AXES: StanceAxes = {
  directed: "How much it leans on this",
  interest: "For or against",
  left: "Barely",
  right: "Entirely",
  bottom: "Against",
  top: "For",
};

/** What a family brings to the one sheet. */
type PairFamily = {
  readonly axes: StanceAxes;
  readonly ranges: PadRanges;
  /** The field's group name — "The pair this tag signs". */
  readonly groupLabel: string;
  /** How each slot's value is written: a tag's confidence carries no sign. */
  readonly formatDirected: (value: number) => string;
  readonly formatInterest: (value: number) => string;
  /** The face beside the exact pair. */
  readonly face: (pair: StancePair) => string;
  /** The exact pair as the eye reads it. */
  readonly exact: (pair: StancePair) => string;
  /** The readout's spoken reading. */
  readonly spoken: (pair: StancePair) => string;
};

/** Both axes named with their values — the part every spoken reading carries. */
function axesSpoken(family: Omit<PairFamily, "spoken">, pair: StancePair): string {
  return (
    `${family.axes.directed} ${family.formatDirected(pair.pDirected)}, ` +
    `${family.axes.interest} ${family.formatInterest(pair.pInterest)}`
  );
}

const TAG_FAMILY_BASE = {
  axes: TAG_PAIR_AXES,
  ranges: TAG_RANGES,
  groupLabel: "The pair this tag signs",
  formatDirected: (value: number) => formatDimension(value),
  formatInterest: formatConfidence,
  // The tag's own thirteen objects — never a stance face.
  face: (pair: StancePair) => nearestTagAnchor(pair.pDirected, pair.pInterest).emoji,
  exact: (pair: StancePair) => formatTagPair(pair.pDirected, pair.pInterest),
};

/**
 * THE TAG'S FAMILY. Its anchors' words were written for this table and say
 * what the pair claims, so the spoken reading carries the word AND both axes.
 */
export const TAG_FAMILY: PairFamily = {
  ...TAG_FAMILY_BASE,
  spoken: (pair) =>
    `Your pick: ${nearestTagAnchor(pair.pDirected, pair.pInterest).label}. ${axesSpoken(TAG_FAMILY_BASE, pair)}`,
};

const CITATION_FAMILY_BASE = {
  axes: CITATION_PAIR_AXES,
  ranges: STANCE_RANGES,
  groupLabel: "The pair this citation signs",
  formatDirected: (value: number) => formatDimension(value),
  formatInterest: (value: number) => formatDimension(value),
  // The stance table unchanged: a citation's slots are the slots it is drawn over.
  face: (pair: StancePair) => nearestAnchor(pair).emoji,
  exact: (pair: StancePair) => formatStancePair(pair),
};

/**
 * THE CITATION'S FAMILY. The face is a lossy readout and survives the change
 * of family; the anchor's WORD does not — the spoken reading names the two
 * axes and their values instead.
 */
export const CITATION_FAMILY: PairFamily = {
  ...CITATION_FAMILY_BASE,
  spoken: (pair) => `Your pick: ${axesSpoken(CITATION_FAMILY_BASE, pair)}`,
};

export function PairSheet({
  open,
  title,
  value,
  family,
  onDone,
  onDiscard,
  testId,
}: {
  open: boolean;
  /** What the sheet edits — the tag (`#name`) or the citation's label. */
  title: string;
  /** The pair as it stands before the sheet opens. */
  value: StancePair;
  family: PairFamily;
  /** Done: the sheet's staged pair, handed out once. */
  onDone: (pair: StancePair) => void;
  /** Every other way out — nothing staged in the sheet applies. */
  onDiscard: () => void;
  testId: string;
}) {
  const [pick, setPick] = useState(value);
  const [exactRoute, setExactRoute] = useState(false);
  const routeRef = useRef<HTMLButtonElement | null>(null);

  // EACH OPENING STARTS FROM THE PAIR AS IT STANDS, adjusted during render
  // rather than in an effect (the same derivation `BottomSheet` uses for its
  // own direction): whatever a discarded opening staged is gone.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPick(value);
      setExactRoute(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onDiscard}
      title={title}
      testId={testId}
      initialFocus={routeRef}
    >
      <div className="flex flex-col gap-4 pb-1">
        <button
          ref={routeRef}
          type="button"
          data-testid={`${testId}-exact-route`}
          aria-pressed={exactRoute}
          onClick={() => setExactRoute((shown) => !shown)}
          className={`sr-only focus:not-sr-only ${buttonClassName({ variant: "text", size: "sm" })}`}
        >
          Set exact values for {title}
        </button>

        {/* THE PICK'S READOUT STANDS ABOVE THE FIELD — a thumb on the field
            covers exactly the spot where feedback would otherwise appear. The
            face and the digits are for the eye; the spoken twin names both
            axes, because the numbers alone say nothing about which slot they
            fill. */}
        <div
          aria-live="polite"
          data-testid={`${testId}-readout`}
          className="flex flex-col items-center"
        >
          <span aria-hidden="true" className="text-label-small text-on-surface-variant">
            Your pick
          </span>
          <span aria-hidden="true" className="inline-flex items-baseline gap-2">
            <span data-testid={`${testId}-face`} className="text-title-large">
              {family.face(pick)}
            </span>
            <span data-testid={`${testId}-exact`} className="whitespace-nowrap text-body-small">
              {family.exact(pick)}
            </span>
          </span>
          <span data-testid={`${testId}-spoken`} className="sr-only">
            {family.spoken(pick)}
          </span>
        </div>

        <div role="group" aria-label={family.groupLabel} data-testid={`${testId}-group`}>
          {exactRoute ? (
            <ExactTracks
              pick={pick}
              onPick={setPick}
              family={family}
              testId={`${testId}-tracks`}
            />
          ) : (
            <PairField
              value={pick}
              onChange={setPick}
              axes={family.axes}
              ranges={family.ranges}
              ariaLabel={family.groupLabel}
              testId={`${testId}-field`}
            />
          )}
        </div>

        {/* No walk-away: nothing on this path has been signed, so there is no
            withdrawal to ask for — the chip's × is the whole of taking it out. */}
        <div className="flex items-center gap-2 border-t border-outline-variant pt-2.5">
          <span className="flex-1 text-body-small text-on-surface-variant">
            Signed with the post, as its own action.
          </span>
          <PillButton testId={`${testId}-done`} onClick={() => onDone(pick)}>
            Done
          </PillButton>
        </div>
      </div>
    </BottomSheet>
  );
}

/**
 * THE NON-DRAG ROUTE, in the field's place: the two tracks over the family's
 * reach with its questions and poles, and typing one quiet tap away — never
 * both at once (`StanceAlternates.jsx`, "one control at a time").
 */
function ExactTracks({
  pick,
  onPick,
  family,
  testId,
}: {
  pick: StancePair;
  onPick: (pair: StancePair) => void;
  family: PairFamily;
  testId: string;
}) {
  const [showing, setShowing] = useState<"sliders" | "entry">("sliders");
  const set = (next: StancePair) => onPick(clampToRanges(next, family.ranges));
  const directed = {
    label: family.axes.directed,
    low: family.axes.left,
    high: family.axes.right,
    range: family.ranges.pDirected,
    value: pick.pDirected,
    format: family.formatDirected,
    onChange: (pDirected: number) => set({ ...pick, pDirected }),
    testId: `${testId}-directed`,
  };
  const interest = {
    label: family.axes.interest,
    low: family.axes.bottom,
    high: family.axes.top,
    range: family.ranges.pInterest,
    value: pick.pInterest,
    format: family.formatInterest,
    onChange: (pInterest: number) => set({ ...pick, pInterest }),
    testId: `${testId}-interest`,
  };
  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      {showing === "sliders" ? (
        <>
          <Track {...directed} />
          <Track {...interest} />
        </>
      ) : (
        <>
          <Entry {...directed} />
          <Entry {...interest} />
        </>
      )}
      <button
        type="button"
        data-testid={`${testId}-swap`}
        onClick={() => setShowing((current) => (current === "sliders" ? "entry" : "sliders"))}
        className={`self-start ${buttonClassName({ variant: "text", size: "sm" })}`}
      >
        {showing === "sliders" ? "Type exact values" : "Use sliders"}
      </button>
    </div>
  );
}

type AxisControl = {
  label: string;
  low: string;
  high: string;
  range: AxisRange;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  testId: string;
};

function Track({ label, low, high, range, value, format, onChange, testId }: AxisControl) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label-large">
        {label} {format(value)}
      </label>
      <input
        id={id}
        data-testid={testId}
        type="range"
        min={range.min}
        max={range.max}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
      <span aria-hidden="true" className="flex justify-between text-label-small text-on-surface-variant">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </div>
  );
}

function Entry({ label, range, value, onChange, testId }: AxisControl) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-label-large">
        {label}
      </label>
      <input
        id={id}
        data-testid={testId}
        type="number"
        inputMode="decimal"
        min={range.min}
        max={range.max}
        step={0.01}
        value={value}
        onChange={(event) => {
          const typed = Number(event.target.value);
          if (Number.isFinite(typed)) onChange(typed);
        }}
        className="w-24 rounded-extra-small border border-outline p-2 text-body-medium"
      />
    </div>
  );
}
