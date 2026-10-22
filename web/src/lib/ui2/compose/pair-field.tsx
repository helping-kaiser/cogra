"use client";

// THE PAIR FIELD — the master `StancePad` with its family's words and its
// census's reach (`design/components/stance/StancePad.jsx`, `axes` + `ranges`),
// as the composer's pair sheets draw it (`TagPadCompose.jsx`, `RefPair.jsx`).
//
// A PAIR IS A PLACE, AND A PLACE IS PICKED IN ONE GESTURE. Both of a tag's
// parameters and both of a citation's are the author's to set, so the
// instrument is one field rather than two tracks. The control owns the
// geometry and the record family owns the words: the four pole words ring the
// field, each pushed against the edge it names, and the slots reach as far as
// `ranges` says — a tag's relevance floors at +0.01 and its confidence runs
// 0 to 1; a citation's square is the stance's own signed one.
//
// THE FIELD OWNS ITS POINTERS. A drag that starts on the field moves the knob,
// never the sheet it stands on — the sheet's pull-to-drop reads pointers on the
// whole surface, so the press stops here (`TagPad.jsx`: "drags only from its
// handle and title zone").
//
// THE GEOMETRY IS THE SHARED ONE: `pad-geometry`'s ranged forms own where
// travel lands and where the knob sits, so this field and the stance square
// cannot drift into two ideas of what a finger is worth.
//
// RELEASE LANDS THE PAIR ON THE HUNDREDTHS GRID (the value domain, jakob
// 2026-10-20): the knob follows the finger, and the lift parks both slots on
// the nearest hundredth inside the field's reach — a tag's relevance never
// below its +0.01 floor.
//
// THE KEYBOARD WALKS IT TOO. The sheet's non-drag route is the declared
// accessible path; the arrows are a convenience on top, held to the same reach
// and the same grid.

import { useRef, useState } from "react";

import type { StancePair } from "@/lib/stance/model";
import {
  KNOB_TRAVEL_INSET_PX,
  rangedPairFrom,
  rangedPercentOf,
  snapToRanges,
  zeroPercentOf,
  type PadRanges,
} from "@/lib/stance/pad-geometry";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import type { StanceAxes } from "@/lib/ui/stance-format";

/** One arrow press, and one with shift held. */
const STEP = 0.05;
const COARSE_STEP = 0.2;

const ARROWS: Readonly<Record<string, { readonly dx: number; readonly dy: number }>> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: 1 },
  ArrowDown: { dx: 0, dy: -1 },
};

export function PairField({
  value,
  onChange,
  axes,
  ranges,
  ariaLabel,
  testId,
  node,
}: {
  value: StancePair;
  onChange: (next: StancePair) => void;
  /** The family's four pole words (and its two questions, unused on the field). */
  axes: StanceAxes;
  /** How far each slot reaches. */
  ranges: PadRanges;
  ariaLabel: string;
  testId: string;
  /**
   * The registered field (`<host>.stance.pad.field`, ruling 40): the whole
   * field with its words, the four pole words by the side they stand on, and
   * the `square` with its `knob` and dead-ground lines. Handed none, the
   * parts keep their `testId` ids.
   */
  node?: DataNode;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  // `last` is the pair the drag most recently reported, held here rather than
  // read back from `value`: the lift can arrive before the move's render.
  const drag = useRef<{ x: number; y: number; base: StancePair; last: StancePair | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  const knob = rangedPercentOf(value, ranges);
  const zeroAcross = zeroPercentOf(ranges.pInterest);
  const zeroDown = zeroPercentOf(ranges.pDirected);

  const endDrag = () => {
    const last = drag.current?.last ?? null;
    drag.current = null;
    setDragging(false);
    // A tap that never travelled moves nothing — not even onto the grid.
    if (last !== null) onChange(snapToRanges(last, ranges));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const arrow = ARROWS[event.key];
    if (arrow === undefined) return;
    // The field owns the arrows: without this the sheet scrolls under the
    // reader instead of the knob moving.
    event.preventDefault();
    const step = event.shiftKey ? COARSE_STEP : STEP;
    onChange(
      snapToRanges(
        {
          pDirected: value.pDirected + arrow.dx * step,
          pInterest: value.pInterest + arrow.dy * step,
        },
        ranges,
      ),
    );
  };

  return (
    <div className="relative w-full px-[56px] py-[20px]" {...testAttributes(node, testId)}>
      {/* THE AXES ARE NAMED AROUND THE FIELD, in the family's own words. */}
      <div aria-hidden="true" className="absolute inset-0 text-label-small text-on-surface-variant">
        <span
          {...testAttributes(part(node, "left"), `${testId}-left`)}
          className="absolute left-0 top-1/2 w-[50px] -translate-y-1/2 whitespace-nowrap text-right"
        >
          {axes.left}
        </span>
        <span
          {...testAttributes(part(node, "right"), `${testId}-right`)}
          className="absolute right-0 top-1/2 w-[50px] -translate-y-1/2 whitespace-nowrap text-left"
        >
          {axes.right}
        </span>
        <span
          {...testAttributes(part(node, "top"), `${testId}-top`)}
          className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap"
        >
          {axes.top}
        </span>
        <span
          {...testAttributes(part(node, "bottom"), `${testId}-bottom`)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap"
        >
          {axes.bottom}
        </span>
      </div>
      <div
        ref={fieldRef}
        {...testAttributes(part(node, "square"), `${testId}-square`)}
        // NOT `role="slider"`: a slider has one value and this field has two.
        // It is a focusable region named by its group; the sheet's non-drag
        // route is the declared accessible path.
        tabIndex={0}
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          // The press is the field's, never the sheet's pull-to-drop.
          event.stopPropagation();
          drag.current = { x: event.clientX, y: event.clientY, base: value, last: null };
          setDragging(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          const from = drag.current;
          const field = fieldRef.current;
          if (from === null || field === null) return;
          const next = rangedPairFrom(
            from.base,
            field.getBoundingClientRect(),
            { dx: event.clientX - from.x, dy: event.clientY - from.y },
            KNOB_TRAVEL_INSET_PX,
            ranges,
          );
          from.last = next;
          onChange(next);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          endDrag();
        }}
        onPointerCancel={(event) => {
          event.stopPropagation();
          endDrag();
        }}
        className="cg-focus relative aspect-square w-full touch-none rounded-large bg-surface-container-highest"
      >
        {/* Dead ground, drawn where a slot crosses zero — on a tag's field
            neither does, so no line stands on the field's own edge. */}
        {zeroAcross !== null && (
          <div
            aria-hidden="true"
            {...testAttributes(part(node, "square.zeroAcross"), `${testId}-zero-across`)}
            style={{ top: `${zeroAcross}%` }}
            className="absolute left-0 h-px w-full bg-outline-variant"
          />
        )}
        {zeroDown !== null && (
          <div
            aria-hidden="true"
            {...testAttributes(part(node, "square.zeroDown"), `${testId}-zero-down`)}
            style={{ left: `${zeroDown}%` }}
            className="absolute top-0 h-full w-px bg-outline-variant"
          />
        )}
        {/* The knob's centre travels this inset box, which is what keeps the
            knob itself inside the drawn corner. */}
        <div aria-hidden="true" className="absolute" style={{ inset: `${KNOB_TRAVEL_INSET_PX}px` }}>
          {/* The pressed state layer while held: a layer, never a scale. */}
          {dragging && (
            <div
              style={{ left: `${knob.x}%`, top: `${knob.y}%` }}
              className="absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container opacity-10"
            />
          )}
          <div
            {...testAttributes(part(node, "square.knob"), `${testId}-knob`)}
            style={{ left: `${knob.x}%`, top: `${knob.y}%` }}
            className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container"
          />
        </div>
      </div>
    </div>
  );
}
