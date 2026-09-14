"use client";

// THE ONE-AXIS FIELD — `ComposePad.jsx:79-83`'s 260×72 line.
//
// The two-axis `StancePad` is a square because the square IS the value
// space: Against/For across, Less/More up, both parameters the author's
// to choose. On one's own post the second is not — a post always reaches
// its author in full — so what is left is a line, and a line is drawn as
// one. A slider in its place is a different instrument: a track and a
// thumb say "a setting", where the drawn field says "this box is the
// value", which is the sentence every other pad in the product says.
//
// EVERYTHING IT SHARES WITH THE SQUARE IS SHARED IN FACT, not by
// resemblance: `pad-geometry` owns the travel rule and the inset that
// keeps the knob's centre inside the drawn corner, so the two fields
// cannot drift into two different ideas of what a finger is worth.
//
// THE KEYBOARD IS NOT AN AFTERTHOUGHT. A drag is the pad's gesture, and
// a gesture nobody can perform is not an input. Unlike the square this
// field carries exactly one value, so `role="slider"` is the truth here
// rather than a lie an assistive technology would act on.

import { useRef, useState } from "react";

import { clampDimension } from "@/lib/stance/model";
import { knobTravelInset, padPercentOf, valenceFrom } from "@/lib/stance/pad-geometry";
import { VALENCE_LABEL, VALENCE_POLES } from "@/lib/stance/valence";
import { formatDimension } from "@/lib/ui/stance-format";

/** The board's knob: 24px, one rung larger than the card pad's. */
const KNOB_DIAMETER_PX = 24;

const INSET_PX = knobTravelInset(undefined, KNOB_DIAMETER_PX);

/** One arrow press, and one with shift held. */
const STEP = 0.05;
const COARSE_STEP = 0.2;

const ARROWS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowUp: 1,
};

export function ValenceField({
  value,
  onChange,
  testId = "valence-field",
}: {
  value: number;
  onChange: (next: number) => void;
  testId?: string;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; base: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const knobPercent = padPercentOf({ pDirected: value, pInterest: 0 }).x;
  const exact = formatDimension(value);

  const moveTo = (event: React.PointerEvent) => {
    const from = drag.current;
    const field = fieldRef.current;
    if (from === null || field === null) return;
    onChange(valenceFrom(from.base, field.getBoundingClientRect(), event.clientX - from.x, INSET_PX));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const direction = ARROWS[event.key];
    if (direction === undefined) return;
    // The field owns the arrows: without this the pad scrolls under the
    // reader instead of the knob moving.
    event.preventDefault();
    const step = event.shiftKey ? COARSE_STEP : STEP;
    onChange(clampDimension(value + direction * step));
  };

  return (
    <div
      ref={fieldRef}
      data-testid={`${testId}-field`}
      role="slider"
      tabIndex={0}
      aria-label={VALENCE_LABEL}
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={value}
      aria-valuetext={`${VALENCE_LABEL} ${exact}`}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, base: value };
        setDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragging) moveTo(event);
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      className="cg-focus relative h-[72px] w-full max-w-[260px] touch-none self-center rounded-large bg-surface-container-highest"
    >
      {/* Dead ground, drawn rather than hidden: the model reads as
          legible instead of mysterious. The vertical stroke marks the
          zero the knob passes through — it is not a second axis. */}
      <span aria-hidden="true" className="absolute top-1/2 right-2 left-2 h-px bg-outline-variant" />
      <span aria-hidden="true" className="absolute top-2 bottom-2 left-1/2 w-px bg-outline-variant" />

      <span
        aria-hidden="true"
        className="absolute top-1/2 left-2 -translate-y-1/2 bg-surface-container-highest px-0.5 text-label-small text-on-surface-variant"
      >
        {VALENCE_POLES[0]}
      </span>
      <span
        aria-hidden="true"
        className="absolute top-1/2 right-2 -translate-y-1/2 bg-surface-container-highest px-0.5 text-label-small text-on-surface-variant"
      >
        {VALENCE_POLES[1]}
      </span>

      {/* The knob's centre travels this inset box, which is what keeps
          the knob itself inside the drawn corner. */}
      <div aria-hidden="true" className="absolute" style={{ inset: `${INSET_PX}px` }}>
        <div
          data-testid={`${testId}-knob`}
          style={{ left: `${knobPercent}%` }}
          className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-on-primary-container bg-primary-container"
        />
      </div>
    </div>
  );
}
