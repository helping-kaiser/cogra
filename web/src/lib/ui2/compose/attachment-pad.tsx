"use client";

// THE ONE-AXIS FIELD — the master `AttachmentPad`
// (`design/components/stance/StancePad.jsx`, jakob 2026-10-16, PR-101): the
// pad an author meets when they sign their own content.
//
// Publish carries the author's attachment — their BACKING — in `p_d`, and the
// census pins `p_i` at 1, never a choice. So the value space is a line, and
// the line is drawn as one: offering the square here would offer a second axis
// the record cannot carry.
//
// IT IS THE SQUARE'S OWN LANGUAGE, CUT TO ONE AXIS (`PairField`'s anatomy):
// the same field at the large rung, the same 20px knob and its pressed layer,
// the same dead-ground hairline at zero, and the pole words held OUTSIDE the
// field in the same 56px gutters (the 2026-09-15 ruling: a word inside the
// value space is a word the knob covers). What it leaves out is everything the
// second axis owned: no vertical travel, no `Less`/`More`, no hairline across.
//
// THE PICK IS ACCUMULATED TRAVEL, as on the square: the knob starts where the
// value is, wherever the press lands, and only horizontal travel moves it —
// `valenceFrom`, the master's `attachmentFrom`, one pixel worth the same as
// the square's.
//
// RELEASE LANDS THE PICK ON THE NEAREST HUNDREDTH (ComposePad.md, EditPad.md):
// the knob follows the finger wherever it is, and the lift parks the pick on
// the grid — so the number a readout prints is the pick itself, and a pick
// that reads `+0.00` is the exact 0 the gates ask about.
//
// THE KEYBOARD WALKS IT TOO. The field carries exactly one value, so
// `role="slider"` is the truth here, and the arrows step it.

import { useRef, useState } from "react";

import { clampDimension, snapDimension } from "@/lib/stance/model";
import { KNOB_TRAVEL_INSET_PX, valenceFrom } from "@/lib/stance/pad-geometry";
import { VALENCE_LABEL, VALENCE_POLES } from "@/lib/stance/valence";
import { formatDimension } from "@/lib/ui/stance-format";

/** The strip's height (`ATTACHMENT_FIELD_HEIGHT_PX`). */
export const ATTACHMENT_FIELD_HEIGHT_PX = 56;

/** One arrow press, and one with shift held. */
const STEP = 0.05;
const COARSE_STEP = 0.2;

const ARROWS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowUp: 1,
};

/**
 * Where the knob sits on the strip, as a percentage of its travel — the
 * master's `attachmentPercentOf`.
 */
export function attachmentPercentOf(value: number): number {
  return 50 + clampDimension(value) * 50;
}

export function AttachmentPad({
  value,
  onChange,
  testId,
}: {
  value: number;
  onChange: (next: number) => void;
  testId: string;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  // `last` is the pick the drag most recently reported, held here rather than
  // read back from `value`: the lift can arrive before the move's render.
  const drag = useRef<{ x: number; base: number; last: number | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  const knobX = attachmentPercentOf(value);
  const exact = formatDimension(value);

  const endDrag = () => {
    const last = drag.current?.last ?? null;
    drag.current = null;
    setDragging(false);
    // A tap that never travelled moves nothing — not even onto the grid.
    if (last !== null) onChange(snapDimension(last));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const direction = ARROWS[event.key];
    if (direction === undefined) return;
    // The field owns the arrows: without this the pad scrolls under the
    // reader instead of the knob moving.
    event.preventDefault();
    const step = event.shiftKey ? COARSE_STEP : STEP;
    // A step lands on a hundredth, so the arrows reach EXACTLY 0.00 — the
    // value that wears 🤔 and that a compose Set asks about — rather than a
    // float's 1e-17 that reads `+0.00` beside a smiling face.
    onChange(snapDimension(value + direction * step));
  };

  return (
    <div className="relative w-full px-[56px]" data-testid={testId}>
      {/* The pole words, in the gutters beside the strip. */}
      <div aria-hidden="true" className="absolute inset-0 text-label-small text-on-surface-variant">
        <span
          data-testid={`${testId}-left`}
          className="absolute left-0 top-1/2 w-[50px] -translate-y-1/2 whitespace-nowrap text-right"
        >
          {VALENCE_POLES[0]}
        </span>
        <span
          data-testid={`${testId}-right`}
          className="absolute right-0 top-1/2 w-[50px] -translate-y-1/2 whitespace-nowrap text-left"
        >
          {VALENCE_POLES[1]}
        </span>
      </div>
      <div
        ref={fieldRef}
        data-testid={`${testId}-strip`}
        role="slider"
        tabIndex={0}
        aria-label={VALENCE_LABEL}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-valuetext={`${VALENCE_LABEL} ${exact}`}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, base: value, last: null };
          setDragging(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const from = drag.current;
          const field = fieldRef.current;
          if (from === null || field === null) return;
          const next = valenceFrom(
            from.base,
            field.getBoundingClientRect(),
            event.clientX - from.x,
            KNOB_TRAVEL_INSET_PX,
          );
          from.last = next;
          onChange(next);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ height: `${ATTACHMENT_FIELD_HEIGHT_PX}px` }}
        className="cg-focus relative w-full touch-none rounded-large bg-surface-container-highest"
      >
        {/* Dead ground at zero, drawn down only — a crossing line would draw a
            zero for an axis that is not there. */}
        <div
          aria-hidden="true"
          data-testid={`${testId}-zero-down`}
          className="absolute left-1/2 top-0 h-full w-px bg-outline-variant"
        />
        {/* The knob's centre travels the strip inset by the square's own inset,
            so it never leaves the drawn shape. */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-0"
          style={{ left: `${KNOB_TRAVEL_INSET_PX}px`, right: `${KNOB_TRAVEL_INSET_PX}px` }}
        >
          {/* The pressed state layer while held: a layer, never a scale. */}
          {dragging && (
            <div
              data-testid={`${testId}-knob-layer`}
              style={{ left: `${knobX}%` }}
              className="absolute top-0 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container opacity-10"
            />
          )}
          <div
            data-testid={`${testId}-knob`}
            style={{ left: `${knobX}%` }}
            className="absolute top-0 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container"
          />
        </div>
      </div>
    </div>
  );
}
