import React from "react";
import { clampDimension, clampPair, ORIGIN } from "./StanceReadout.jsx";

/* The pad's field: a SOFT ROUNDED SQUARE, and THE DRAWN FIELD IS THE VALUE SPACE
   (design.md §8.3). The knob travels exactly the field, the corners are (±1, ±1),
   and the knob never leaves the drawn shape — what the finger sees is what the
   value does. Horizontal runs Against → For, vertical runs Less → More, and those
   four words are drawn on the field; screen y grows downward and connection grows
   upward, so the vertical mapping inverts.

   Containment is STRUCTURAL, not arithmetic: the knob's centre travels a box inset
   from the field, and the inset is the smallest one that keeps a 20px knob inside
   a 16px corner. The inert centre-lines are drawn as visibly DEAD GROUND rather
   than hidden, so the model reads as legible rather than mysterious.

   The pick is ACCUMULATED TRAVEL from where the pointer went down, never its
   absolute position: the pad opens at the origin wherever the press landed. */

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

/** The pair this much travel picks, starting from `base`. Clamped once, on the sum. */
export function padPairFrom(base, rect, travel, inset = KNOB_TRAVEL_INSET_PX) {
  const halfExtent = padTravelHalfExtent(rect, inset);
  if (halfExtent === 0) return clampPair(base);
  return clampPair({
    pDirected: base.pDirected + travel.dx / halfExtent,
    pInterest: base.pInterest - travel.dy / halfExtent,
  });
}

/** Where the knob sits, as a percentage of the travel box. */
export function padPercentOf(pair) {
  return { x: 50 + clampDimension(pair.pDirected) * 50, y: 50 - clampDimension(pair.pInterest) * 50 };
}

export function StancePad({ value = ORIGIN, onChange, fieldRef, showAxes = true }) {
  const localRef = React.useRef(null);
  const ref = fieldRef ?? localRef;
  const drag = React.useRef(null);
  const knob = padPercentOf(value);

  const onPointerDown = (event) => {
    if (!onChange) return;
    drag.current = { x: event.clientX, y: event.clientY, base: value };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const from = drag.current;
    const field = ref.current;
    if (!from || !field || !onChange) return;
    onChange(padPairFrom(from.base, field.getBoundingClientRect(), { dx: event.clientX - from.x, dy: event.clientY - from.y }));
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
        background: "var(--surface-field)",
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", left: 0, top: "50%", height: "1px", width: "100%", background: "var(--border-hairline)" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: 0, width: "1px", height: "100%", background: "var(--border-hairline)" }} />
      {/* THE AXES ARE NAMED ON THE FIELD. A blank square says nothing about which
         direction means what, and the words are the same four the sliders use, so
         the two surfaces teach each other. `label-small` on `onSurfaceVariant`:
         present without competing with the knob. */}
      {showAxes && (
        <div aria-hidden="true" style={{ position: "absolute", inset: "6px", fontSize: "var(--text-label-small)", color: "var(--text-secondary)" }}>
          <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)" }}>Against</span>
          <span style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>For</span>
          <span style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)" }}>More</span>
          <span style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)" }}>Less</span>
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
