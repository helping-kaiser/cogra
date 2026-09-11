import React from "react";
import { clampPair, ORIGIN, DIRECTED_POLES, INTEREST_POLES, STANCE_RANGES } from "./StanceReadout.jsx";

/* The pad's field: a SOFT ROUNDED SQUARE, and THE DRAWN FIELD IS THE VALUE SPACE
   (design.md §8.3). The knob travels exactly the field, the corners are the two
   axes' own ends — (±1, ±1) for a stance, (0, 0) to (1, 1) for a tag — and the
   knob never leaves the drawn shape, so what the finger sees is what the value
   does. Horizontal runs Against → For, vertical runs Less → More, and those four
   words are drawn on the field; screen y grows downward and connection grows
   upward, so the vertical mapping inverts.

   Containment is STRUCTURAL, not arithmetic: the knob's centre travels a box inset
   from the field, and the inset is the smallest one that keeps a 20px knob inside
   a 16px corner. The inert centre-lines are drawn as visibly DEAD GROUND rather
   than hidden, so the model reads as legible rather than mysterious.

   The pick is ACCUMULATED TRAVEL from where the pointer went down, never its
   absolute position: the pad opens at the origin wherever the press landed. */

/* THE FIELD'S FOUR WORDS ARE THE SLOTS' WORDS, NOT THE STANCE'S. The pad's
   geometry is bound to `(pDirected, pInterest)` — horizontal is the directed
   slot, vertical the interest slot — and a stance is not the only record whose
   two user parameters are both signed. A citation's are too (`ReferenceInput`,
   api-spec.md), and they mean different things in the same two slots, so the
   words that name the poles travel with the record family rather than living
   in the control. The default is the stance's four, because the stance is what
   this pad was drawn for. */
export const STANCE_AXES = {
  left: DIRECTED_POLES[0],
  right: DIRECTED_POLES[1],
  bottom: INTEREST_POLES[0],
  top: INTEREST_POLES[1],
};

export const FIELD_CORNER_RADIUS_PX = 16;
export const KNOB_DIAMETER_PX = 20;

export function knobTravelInset(cornerRadius = FIELD_CORNER_RADIUS_PX, knobDiameter = KNOB_DIAMETER_PX) {
  const knobRadius = knobDiameter / 2;
  return Math.max(knobRadius, cornerRadius - (cornerRadius - knobRadius) / Math.SQRT2);
}

export const KNOB_TRAVEL_INSET_PX = knobTravelInset();

export function padTravelHalfExtent(rect, inset = KNOB_TRAVEL_INSET_PX) {
  return Math.max(0, Math.min(rect.width, rect.height) / 2 - inset);
}

/** How much one pixel of travel is worth on an axis that spans `range`. */
function perPixel(range, halfExtent) {
  return (range.max - range.min) / (2 * halfExtent);
}

/** Where a value sits on its axis, 0 at the range's low end and 1 at its high end. */
function fractionOf(value, range) {
  return (value - range.min) / (range.max - range.min);
}

/* A PERCENTAGE IS ROUNDED BEFORE IT REACHES A STYLE. Binary floating point makes
   the same position come out as 55 or as 55.00000000000001 depending on the order
   the multiply and the add happen in, and a rendered board is compared byte for
   byte by the design gate. Six decimals is far below a device pixel on any field
   this pad is drawn at, so nothing moves and the output stops depending on
   arithmetic order. */
function percent(fraction) {
  return Math.round(fraction * 1e8) / 1e6;
}

/** The pair this much travel picks, starting from `base`. Clamped once, on the sum. */
export function padPairFrom(base, rect, travel, inset = KNOB_TRAVEL_INSET_PX, ranges = STANCE_RANGES) {
  const halfExtent = padTravelHalfExtent(rect, inset);
  if (halfExtent === 0) return clampPair(base, ranges);
  return clampPair(
    {
      pDirected: base.pDirected + travel.dx * perPixel(ranges.pDirected, halfExtent),
      pInterest: base.pInterest - travel.dy * perPixel(ranges.pInterest, halfExtent),
    },
    ranges,
  );
}

/** Where the knob sits, as a percentage of the travel box. */
export function padPercentOf(pair, ranges = STANCE_RANGES) {
  const bounded = clampPair(pair, ranges);
  return {
    x: percent(fractionOf(bounded.pDirected, ranges.pDirected)),
    y: 100 - percent(fractionOf(bounded.pInterest, ranges.pInterest)),
  };
}

/* THE DEAD-GROUND LINE MARKS THE AXIS'S ZERO, so an axis whose zero is its own
   end has none to draw. On a stance's signed square both lines cross the middle
   and the inert cross is legible dead ground (§8.3). The tag pad's axes both
   start at zero, and zero relevance there is not inert ground a knob passes
   over — it is the withdrawal, which the sheet says in words. A hairline
   painted along the field's own edge would read as a border, not a meaning. */
function zeroPercentOf(range) {
  return range.min < 0 && range.max > 0 ? percent(fractionOf(0, range)) : null;
}

export function StancePad({ value = ORIGIN, onChange, fieldRef, showAxes = true, axes = STANCE_AXES, ranges = STANCE_RANGES }) {
  const localRef = React.useRef(null);
  const ref = fieldRef ?? localRef;
  const drag = React.useRef(null);
  const knob = padPercentOf(value, ranges);
  const zeroAcross = zeroPercentOf(ranges.pInterest);
  const zeroDown = zeroPercentOf(ranges.pDirected);

  const onPointerDown = (event) => {
    if (!onChange) return;
    drag.current = { x: event.clientX, y: event.clientY, base: value };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const from = drag.current;
    const field = ref.current;
    if (!from || !field || !onChange) return;
    onChange(
      padPairFrom(
        from.base,
        field.getBoundingClientRect(),
        { dx: event.clientX - from.x, dy: event.clientY - from.y },
        KNOB_TRAVEL_INSET_PX,
        ranges,
      ),
    );
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        width: "100%",
        touchAction: "none",
        borderRadius: "var(--radius-large)",
        background: "var(--surface-container-highest)",
      }}
    >
      {zeroAcross !== null && (
        <div aria-hidden="true" style={{ position: "absolute", left: 0, top: `${zeroAcross}%`, height: "1px", width: "100%", background: "var(--border-hairline)" }} />
      )}
      {zeroDown !== null && (
        <div aria-hidden="true" style={{ position: "absolute", left: `${zeroDown}%`, top: 0, width: "1px", height: "100%", background: "var(--border-hairline)" }} />
      )}
      {/* THE AXES ARE NAMED ON THE FIELD. A blank square says nothing about which
         direction means what, and for a stance the words are the same four the
         sliders use, so the two surfaces teach each other. `label-small` on
         `onSurfaceVariant`: present without competing with the knob. */}
      {showAxes && (
        <div aria-hidden="true" style={{ position: "absolute", inset: "6px", fontSize: "var(--text-label-small)", color: "var(--text-secondary)" }}>
          <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)" }}>{axes.left}</span>
          <span style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>{axes.right}</span>
          <span style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)" }}>{axes.top}</span>
          <span style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)" }}>{axes.bottom}</span>
        </div>
      )}
      <div aria-hidden="true" style={{ position: "absolute", inset: `${KNOB_TRAVEL_INSET_PX}px` }}>
        <div
          style={{
            position: "absolute",
            left: `${knob.x}%`,
            top: `${knob.y}%`,
            height: `${KNOB_DIAMETER_PX}px`,
            width: `${KNOB_DIAMETER_PX}px`,
            transform: "translate(-50%, -50%)",
            borderRadius: "var(--radius-full)",
            background: "var(--surface-loud)",
          }}
        />
      </div>
    </div>
  );
}
