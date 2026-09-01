"use client";

// The seal's stance pad — design/designs/canonical/ReplyPad.
//
// WHY A PAD HERE AND A SLIDER ON THE POST'S SEAL. A Publish record's
// `pInterest` is census-fixed at 1, so a post's author has one free number and
// ComposeSeal shows one slider. A comment's genesis Review carries BOTH
// parameters, so the reply's seal opens the two-axis field the board draws.
//
// THE GEOMETRY IS THE SHARED ONE. `pad-geometry` already owns "where travel
// lands in the value field" for the press-and-hold pad on every card, and it is
// parameterised by the knob it is drawn with — so this pad passes its own 24px
// knob rather than forking the module. The board's knob sits at 55%/45% for
// +0.10 / +0.10, which is `padPercentOf` exactly: the board and the code are
// drawing the same space.
//
// THE KEYBOARD IS NOT AN AFTERTHOUGHT. A drag is the pad's gesture, and a
// gesture nobody can perform is not an input. The field is focusable and the
// arrow keys walk it, with the pair spoken through `aria-valuetext` — the same
// two numbers the readout above shows, so a screen reader and a sighted reader
// are told the same thing.

import { useRef, useState } from "react";

import { clampPair, type StancePair } from "@/lib/stance/model";
import { knobTravelInset, padPairFrom, padPercentOf } from "@/lib/stance/pad-geometry";
import { formatStanceWords } from "@/lib/ui/stance-format";

/** The board's knob: 24px, one rung larger than the card pad's. */
const KNOB_DIAMETER_PX = 24;

const INSET_PX = knobTravelInset(undefined, KNOB_DIAMETER_PX);

/** One arrow press, and one with shift held — a tenth, and a fifth. */
const STEP = 0.05;
const COARSE_STEP = 0.2;

const ARROWS: Readonly<Record<string, { readonly dx: number; readonly dy: number }>> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: 1 },
  ArrowDown: { dx: 0, dy: -1 },
};

/** A caption on the field's edge, sitting on its own scrap of the ground. */
function AxisLabel({ children, className }: { children: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute bg-surface-container-highest px-0.5 text-label-small text-on-surface-variant ${className}`}
    >
      {children}
    </span>
  );
}

export function StancePad({
  value,
  onChange,
  ariaLabel,
  testId = "stance-pad",
}: {
  value: StancePair;
  onChange: (next: StancePair) => void;
  ariaLabel: string;
  testId?: string;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; base: StancePair } | null>(null);
  const [dragging, setDragging] = useState(false);
  const knob = padPercentOf(value);

  const moveTo = (event: React.PointerEvent) => {
    const from = drag.current;
    const field = fieldRef.current;
    if (from === null || field === null) return;
    onChange(
      padPairFrom(
        from.base,
        field.getBoundingClientRect(),
        { dx: event.clientX - from.x, dy: event.clientY - from.y },
        INSET_PX,
      ),
    );
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const arrow = ARROWS[event.key];
    if (arrow === undefined) return;
    // The field owns the arrows: without this the sheet scrolls under the
    // reader instead of the knob moving.
    event.preventDefault();
    const step = event.shiftKey ? COARSE_STEP : STEP;
    onChange(
      clampPair({
        pDirected: value.pDirected + arrow.dx * step,
        pInterest: value.pInterest + arrow.dy * step,
      }),
    );
  };

  return (
    <div
      ref={fieldRef}
      data-testid={`${testId}-field`}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuetext={formatStanceWords(value)}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, y: event.clientY, base: value };
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
      className="cg-focus relative size-60 touch-none self-center rounded-large bg-surface-container-highest"
    >
      {/* Dead ground, drawn rather than hidden: the model reads as legible
          instead of mysterious. Inset from the corners so the captions have
          somewhere to sit. */}
      <span aria-hidden="true" className="absolute left-1/2 top-2 bottom-2 w-px bg-outline-variant" />
      <span aria-hidden="true" className="absolute top-1/2 left-2 right-2 h-px bg-outline-variant" />

      <AxisLabel className="left-2 top-1/2 -translate-y-1/2">Against</AxisLabel>
      <AxisLabel className="right-2 top-1/2 -translate-y-1/2">For</AxisLabel>
      <AxisLabel className="top-2 left-1/2 -translate-x-1/2">More</AxisLabel>
      <AxisLabel className="bottom-2 left-1/2 -translate-x-1/2">Less</AxisLabel>

      {/* The knob's centre travels this inset box, which is what keeps the
          knob itself inside the drawn corner. */}
      <div aria-hidden="true" className="absolute" style={{ inset: `${INSET_PX}px` }}>
        <div
          data-testid={`${testId}-knob`}
          style={{ left: `${knob.x}%`, top: `${knob.y}%` }}
          className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-on-primary-container bg-primary-container"
        />
      </div>
    </div>
  );
}
