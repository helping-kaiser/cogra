"use client";

// THE PAD'S THREE READOUTS (`design/components/stance/StanceReadout.jsx`;
// StanceReadout.prompt.md; readme §11 "Three labelled readouts").
//
//   - `Current opinion` sits ABOVE the field — the bundle as it stands.
//   - `Your pick` sits between it and the field. Its FACE is the lossy
//     readout of the edge being authored — this pick, not the bundle it
//     joins — so the face never means something different depending on
//     history.
//   - `Resulting opinion` sits BELOW the field — the bundle after the pick,
//     folded locally from the served raw sums so it keeps up with the drag.
//
// Each is a label over the face and the pair, formatted identically so the
// eye compares them without reading. THE FACE IS THE DEFAULT READING; THE
// PAIR IS THE GEEK ONE: it is always in the markup, in a `cg-exact` span the
// stylesheet paints only when the screen root carries `data-geek="on"`
// (readme §13). THE ANCHOR'S WORDS ARE NEVER DRAWN — three encodings of one
// value is two too many — but they stay in the accessibility tree: every
// visible readout pairs an `aria-hidden` visual with a screen-reader twin
// that names the opinion and its axes, in both modes.
//
// Nothing sits under the knob: a thumb on the control covers exactly where
// feedback would otherwise appear. The readouts redraw at once and SPEAK
// once the pick has rested 500ms (the K13 round), so a listener hears where
// the pick landed, never every 0.01 it passed.

import { useEffect, useState, type ReactNode } from "react";

import { bundleReadout, nearestAnchor, UNREACHABLE_EMOJI, ZERO_BUNDLE_EMOJI } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import type { StanceBundle, StanceLanding } from "@/lib/stance/stance-data";
import { part, testAttributes, type DataNode, type DataNodeAttributes } from "@/lib/ui/data-node";
import {
  formatStancePair,
  formatStanceWords,
  severanceWords,
  STANCE_AXES,
  STANCE_SEVERANCE_WORDS,
  type StanceAxes,
} from "@/lib/ui/stance-format";

/** What the middle readout is: the edge being authored, not the bundle it joins. */
export const PICK_LABEL = "Your pick";
export const CURRENT_LABEL = "Current opinion";
export const RESULTING_LABEL = "Resulting opinion";

/** A bundle walked back to nothing, as a label beside the shrug. */
export const SEVERED_LABEL = STANCE_SEVERANCE_WORDS.zero;
/** The accessible word for a target never given an opinion. */
export const NO_STANDING_LABEL = "No opinion yet";

/** `undefined` while the standing is still being read, `null` where it could not be. */
export type BundleState = StanceBundle | null | undefined;

/** How long a readout rests before it is spoken (the K13 round). */
export const SETTLE_MS = 500;

/**
 * What the readouts SAY: the value once it has stopped changing for
 * `SETTLE_MS`. The first paint says the value as it stands, so nothing is
 * withheld; only a run of changes is held back until it rests.
 */
export function useSettled<T>(value: T, ms: number = SETTLE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(value, settled)) return undefined;
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, settled, ms]);
  return settled;
}

/**
 * ONE ZERO IS A DELIBERATE STATE, NOT A LOSS (jakob 2026-10-20, seam 240;
 * the master's `UNREACHABLE_TAIL`/`unreachableHead`). A landing with exactly
 * one number at zero is held and shapes no feed — UNREACHABLE — and it is not
 * severance: only `(0, 0)` is, which keeps its own line. The head names the
 * state by the other number's sign; the tail is the one consequence worth
 * saying.
 */
export const UNREACHABLE_TAIL = "this won't shape anyone's feed.";

export function unreachableHead(pair: StancePair): string {
  if (pair.pDirected === 0) {
    return pair.pInterest > 0 ? "Interested, no side taken" : "Rather not see it, no side taken";
  }
  return pair.pDirected > 0 ? "For it, no interest either way" : "Against it, no interest either way";
}

/**
 * THE BORROWED VIEW HOLDS UNTIL AN OPINION IS LIVE (jakob 2026-10-20; the
 * master's `BORROWED_KEPT_LINE`): a reader who holds no outgoing opinion
 * with neither number at zero walks a borrowed view, so a pick that lands
 * unreachable or severed starts no feed of their own. Warns, never blocks.
 */
export const BORROWED_KEPT_LINE = "You'd keep your borrowed view — no feed of your own yet.";

/** A readout either reads as a sentence, or lays out as label · face · pair. */
type ReadoutParts =
  | { readonly sentence: string }
  | {
      readonly label: string;
      readonly emoji: string;
      readonly pair: string;
      readonly spoken: string;
    }
  | {
      readonly label: string;
      readonly emoji: string;
      /** The unreachable state's head, which names the 🤔 door. */
      readonly head: string;
      readonly words: string;
      readonly spoken: string;
    };

/** The bundle, split for rendering (`standingParts`). */
export function standingParts(
  bundle: BundleState,
  targetLabel: string,
  axes: StanceAxes = STANCE_AXES,
): ReadoutParts {
  const sever = severanceWords(axes);
  if (bundle === undefined) return { sentence: "Checking your current opinion…" };
  if (bundle === null || bundle.records === 0) {
    return { sentence: `${ZERO_BUNDLE_EMOJI} No opinion on ${targetLabel} yet.` };
  }
  if (bundle.severed) return { sentence: `${ZERO_BUNDLE_EMOJI} ${sever.gone(targetLabel)}` };
  // A standing, so the table never speaks for zero (§8.4).
  const readout = bundleReadout(bundle.current, sever.zero);
  return {
    label: CURRENT_LABEL,
    emoji: readout.emoji,
    pair: formatStancePair(bundle.current),
    spoken: `${CURRENT_LABEL}: ${readout.label}, ${formatStanceWords(bundle.current, axes)}`,
  };
}

/**
 * The landing, split the same way, in the precedence the fold fixes:
 * severance first, then one zero, then the ordinary reading. `null` is a
 * landing not yet known — it says so rather than showing a stale one.
 */
export function landingParts(
  landing: StanceLanding | null,
  axes: StanceAxes = STANCE_AXES,
): ReadoutParts {
  const sever = severanceWords(axes);
  if (landing === null) return { sentence: "Adding it up…" };
  if (landing.severed) return { sentence: sever.landing };
  if (landing.inert) {
    const head = unreachableHead(landing.landing);
    return {
      label: RESULTING_LABEL,
      emoji: UNREACHABLE_EMOJI,
      head,
      words: `${head} — ${UNREACHABLE_TAIL}`,
      spoken: `${RESULTING_LABEL}: ${head} — ${UNREACHABLE_TAIL}`,
    };
  }
  const readout = bundleReadout(landing.landing, sever.zero);
  return {
    label: RESULTING_LABEL,
    emoji: readout.emoji,
    pair: formatStancePair(landing.landing),
    spoken: `${RESULTING_LABEL}: ${readout.label}, ${formatStanceWords(landing.landing, axes)}`,
  };
}

/** The landing as one line of text — the master's `landingLine`, what is spoken. */
export function landingLine(landing: StanceLanding | null, axes: StanceAxes = STANCE_AXES): string {
  const parts = landingParts(landing, axes);
  if ("sentence" in parts) return parts.sentence;
  if ("words" in parts) return `${parts.label} ${parts.emoji} ${parts.words}`;
  return `${parts.label} ${parts.emoji} ${parts.pair}`;
}

/**
 * The test ids a readout's parts wear: the registered node's parts where the
 * pad has one and the registry names them (`<host>.stance.pad.standing.pick
 * .face`, ruling 40), the legacy prefix ids otherwise.
 */
type ReadoutIds = {
  readonly block: DataNodeAttributes;
  readonly label: DataNodeAttributes;
  readonly face: DataNodeAttributes;
  readonly exact: DataNodeAttributes;
  readonly zero: DataNodeAttributes;
};

function readoutIds(node: DataNode | undefined, legacy: string, partsNamed: boolean): ReadoutIds {
  const named = partsNamed ? node : undefined;
  return {
    block: testAttributes(node, legacy),
    label: testAttributes(part(named, "label"), `${legacy}-label`),
    face: testAttributes(part(named, "face"), `${legacy}-face`),
    exact: testAttributes(part(named, "exact"), `${legacy}-exact`),
    zero: testAttributes(undefined, `${legacy}-zero`),
  };
}

/**
 * ONE LABELLED READOUT: the name of the quantity, then the face and the
 * numbers on the line below it. Three of these stack in the pad, formatted
 * identically so the eye can compare them without reading.
 */
function ReadoutBlock({
  parts,
  ids,
  big = false,
  onExplainZero,
  zeroShown = false,
}: {
  parts: ReadoutParts;
  ids: ReadoutIds;
  /** The pick's own readout reads one rung larger. */
  big?: boolean;
  /** Handed one, an unreachable landing's 🤔 is the door to its explanation. */
  onExplainZero?: () => void;
  zeroShown?: boolean;
}) {
  const said = useSettled("sentence" in parts ? parts.sentence : parts.spoken);
  if ("sentence" in parts) {
    return (
      <p {...ids.block} className="m-0 text-body-small text-on-surface-variant">
        <span aria-hidden="true">{parts.sentence}</span>
        <span className="sr-only">{said}</span>
      </p>
    );
  }
  return (
    <div {...ids.block} className="flex flex-col">
      <span aria-hidden="true" {...ids.label} className="text-label-small text-on-surface-variant">
        {parts.label}
      </span>
      {"words" in parts ? (
        // THE UNREACHABLE LANDING: the zero face and the state in words,
        // where the pair would stand. Handed `onExplainZero`, the face is a
        // door — its explanation replaces the pad's body in place, the "?"'s
        // grammar — named by the state it explains.
        <span className="flex items-baseline gap-2">
          {onExplainZero !== undefined ? (
            <button
              type="button"
              {...ids.zero}
              aria-label={parts.head}
              aria-expanded={zeroShown}
              onClick={onExplainZero}
              className="cg-state cg-focus cg-hit flex-none cursor-pointer border-0 bg-transparent p-0 text-title-medium"
            >
              <span aria-hidden="true">{parts.emoji}</span>
            </button>
          ) : (
            <span aria-hidden="true" {...ids.face} className="flex-none text-title-medium">
              {parts.emoji}
            </span>
          )}
          <span aria-hidden="true" className="text-body-small text-on-surface-variant">
            {parts.words}
          </span>
        </span>
      ) : (
        <span aria-hidden="true" className="inline-flex items-baseline gap-2">
          <span {...ids.face} className={`${big ? "text-title-large" : "text-title-medium"}`}>
            {parts.emoji}
          </span>
          <span
            {...ids.exact}
            className={`cg-exact whitespace-nowrap text-body-small ${big ? "text-on-surface" : "text-on-surface-variant"}`}
          >
            {parts.pair}
          </span>
        </span>
      )}
      <span className="sr-only">{said}</span>
    </div>
  );
}

/** `Current opinion` and `Your pick` — everything that sits above the field. */
export function StanceStanding({
  pick,
  bundle,
  targetLabel,
  testIdPrefix,
  axes = STANCE_AXES,
  node,
  className = "",
}: {
  pick: StancePair;
  bundle: BundleState;
  targetLabel: string;
  testIdPrefix: string;
  /** The record family's own words for the two slots and its way out. */
  axes?: StanceAxes;
  /** The registered `….pad.standing`, where the pad has one. */
  node?: DataNode;
  className?: string;
}) {
  const anchor = nearestAnchor(pick);
  return (
    <div
      aria-live="polite"
      {...testAttributes(node, `${testIdPrefix}-readouts`)}
      className={`flex flex-col gap-2 ${className}`}
    >
      <ReadoutBlock
        parts={standingParts(bundle, targetLabel, axes)}
        ids={readoutIds(part(node, "current"), `${testIdPrefix}-standing`, false)}
      />
      {/* The pick's own readout — above the field, never under the knob,
          because a thumb on the control covers exactly where feedback would
          otherwise sit. */}
      <ReadoutBlock
        big
        parts={{
          label: PICK_LABEL,
          emoji: anchor.emoji,
          pair: formatStancePair(pick),
          spoken: `${PICK_LABEL}: ${anchor.label}, ${formatStanceWords(pick, axes)}`,
        }}
        ids={{
          ...readoutIds(part(node, "pick"), `${testIdPrefix}-pick`, true),
          // The pick's face and pair keep their long-standing ids.
          ...(node === undefined
            ? { face: { "data-testid": `${testIdPrefix}-face` }, exact: { "data-testid": `${testIdPrefix}-exact` } }
            : {}),
        }}
      />
    </div>
  );
}

/**
 * `Resulting opinion` — the one readout that sits below the field.
 * `onExplainZero` makes an unreachable landing's 🤔 the door to its
 * explanation; `borrowed` adds the borrowed-view line under an unreachable or
 * severed landing.
 */
export function StanceLandingLine({
  landing,
  testIdPrefix,
  axes = STANCE_AXES,
  borrowed = false,
  onExplainZero,
  zeroShown = false,
  node,
}: {
  /** The local fold of the pick; null while the standing is being read. */
  landing: StanceLanding | null;
  testIdPrefix: string;
  axes?: StanceAxes;
  /** The reader still borrows a view: they hold no live outgoing opinion. */
  borrowed?: boolean;
  onExplainZero?: () => void;
  zeroShown?: boolean;
  /** The registered `….pad.landing`, where the pad has one. */
  node?: DataNode;
}) {
  const keepsBorrowed = borrowed && landing !== null && (landing.inert || landing.severed);
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      <ReadoutBlock
        parts={landingParts(landing, axes)}
        ids={readoutIds(node, `${testIdPrefix}-landing`, true)}
        onExplainZero={onExplainZero}
        zeroShown={zeroShown}
      />
      {keepsBorrowed && (
        <p
          data-testid={`${testIdPrefix}-landing-borrowed`}
          className="m-0 text-body-small text-on-surface-variant"
        >
          {BORROWED_KEPT_LINE}
        </p>
      )}
    </div>
  );
}

/**
 * The severance read for the confirm, split so the raw total can LEAD and
 * the cap follow it only when the sum passed it (`severanceParts`). These two
 * numbers are the ONE EXEMPTION from geek mode: they paint in both modes,
 * because the sheet exists to show the difference between them.
 */
export function severanceParts(
  bundle: BundleState,
  targetLabel: string,
):
  | { readonly sentence: string }
  | { readonly raw: string; readonly folded: string; readonly capped: boolean } {
  if (bundle === undefined) return { sentence: "Checking your current opinion…" };
  if (bundle === null || bundle.records === 0) {
    return { sentence: `${ZERO_BUNDLE_EMOJI} No opinion on ${targetLabel} yet.` };
  }
  const raw = formatStancePair(bundle.rawSum);
  const folded = formatStancePair(bundle.current);
  return { raw, folded, capped: raw !== folded };
}

/**
 * The confirmation a signed gesture leaves (`StanceReadout.jsx`'s
 * `signedLine`). It names where the gesture LEFT the viewer — the standing
 * they now carry, the pending-inclusive fold, which is what `still settling`
 * is honest about. IT IS BUILT FROM SPANS, NOT A SENTENCE (backlog item
 * 53.1): the face is the reading, the digits ride a `cg-exact` span behind
 * it, and a screen-reader twin says the whole thing — the anchor's word
 * included — in both modes. The severed line has no pair and stays a string.
 */
export function signedLine(
  standing: StancePair,
  records: number,
  severed: boolean,
  targetLabel: string,
  axes: StanceAxes = STANCE_AXES,
): ReactNode {
  const acts = records === 1 ? "Signed" : `Signed ${records} things`;
  const sever = severanceWords(axes);
  if (severed) return `${acts}, still settling. ${sever.gone(targetLabel)}`;
  const readout = bundleReadout(standing, sever.zero);
  return (
    <>
      <span aria-hidden="true">
        {`${acts}, still settling. Current opinion `}
        {readout.emoji}
        <span className="cg-exact">{` (${formatStancePair(standing)})`}</span>
      </span>
      <span className="sr-only">
        {`${acts}, still settling. Current opinion: ${readout.label}, ${formatStanceWords(standing, axes)}`}
      </span>
    </>
  );
}
