import React from "react";
import { clampPair, ORIGIN, DIRECTED_POLES, INTEREST_POLES, STANCE_AXIS_NAMES, STANCE_RANGES } from "./StanceReadout.jsx";

/* The pad's field: a SOFT ROUNDED SQUARE, and THE DRAWN FIELD IS THE VALUE SPACE
   (design.md §8.3). The knob travels exactly the field, the corners are the two
   axes' own ends — (±1, ±1) for a stance, (0, 0) to (1, 1) for a tag — and the
   knob never leaves the drawn shape, so what the finger sees is what the value
   does. Horizontal is the directed slot and vertical the interest slot, and the
   record family's four pole words are drawn at their ends — Against → For and
   Less → More for a stance, the family's own otherwise; screen y grows downward
   and the upper slot grows upward, so the vertical mapping inverts.

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
   this pad was drawn for.

   THE OBJECT CARRIES THE QUESTION AS WELL AS THE ENDS (backlog item 79). A
   family that names its own poles has to name its own axes too, or the two
   halves of one route disagree: a slider labelled `For or against` above a
   track running `Dislike` to `Like` asks about a record the reader is not
   editing. `directed` and `interest` name the two slots the way the pair does,
   and the field ignores them — a pad draws ends, never questions. */
export const STANCE_AXES = {
  ...STANCE_AXIS_NAMES,
  left: DIRECTED_POLES[0],
  right: DIRECTED_POLES[1],
  bottom: INTEREST_POLES[0],
  top: INTEREST_POLES[1],
};

/* THE POLE WORDS SIT OUTSIDE THE FIELD (jakob's ruling 2026-09-15). They were
   drawn INSIDE it, at the four edge midpoints — which is exactly where the
   knob goes when the value reaches that pole, and the knob is an opaque disc
   drawn after them. So the word a reader most needs at the moment they reach
   it was the one word the knob covered: at the top pole it vanished outright,
   the 20px disc landing on a centred label narrower than itself.

   IT COULD NOT BE FIXED BY MAKING THE KNOB READ BETTER. A halo or a plate
   separates the disc from the ink under it, but the ink is still under it —
   and the field IS the value space (design.md §8.3), so the knob travels
   every point a word could occupy. Inside the field, any word is reachable.
   The collision is structural, so the words leave.

   THE GUTTERS ARE THE COMPONENT'S OWN, so a caller sizes the assembly and the
   field takes what the words leave — the pad stays one box to place, and no
   board has to know the ring exists. The four-word anatomy is unchanged: the
   family's own poles, at the four ends, naming the same two axes. */
export const AXIS_GUTTER_X_PX = 56;
export const AXIS_GUTTER_Y_PX = 20;

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

/* THE DEAD-GROUND LINE MARKS THE AXIS'S ZERO, so an axis that never reaches
   zero has none to draw. On a stance's signed square both lines cross the
   middle and the inert cross is legible dead ground (§8.3). The tag pad's
   confidence starts at zero and its relevance above it, so neither line falls
   anywhere but the field's own edge, where a hairline would read as a border
   rather than as a meaning. */
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
      style={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        padding: showAxes ? `${AXIS_GUTTER_Y_PX}px ${AXIS_GUTTER_X_PX}px` : 0,
      }}
    >
      {/* THE AXES ARE NAMED AROUND THE FIELD. A blank square says nothing about
         which direction means what, and for a stance the words are the same
         four the sliders use, so the two surfaces teach each other.
         `label-small` on `onSurfaceVariant`: present without competing with the
         knob — and now never covered by it. Each word is held to its own gutter
         and pushed against the edge it names, so the ring reads as four labels
         on one field rather than text floating near it. */}
      {showAxes && (
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}
        >
          <span style={{ position: "absolute", left: 0, top: "50%", width: `${AXIS_GUTTER_X_PX - 6}px`, transform: "translateY(-50%)", textAlign: "right", whiteSpace: "nowrap" }}>{axes.left}</span>
          <span style={{ position: "absolute", right: 0, top: "50%", width: `${AXIS_GUTTER_X_PX - 6}px`, transform: "translateY(-50%)", textAlign: "left", whiteSpace: "nowrap" }}>{axes.right}</span>
          <span style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{axes.top}</span>
          <span style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{axes.bottom}</span>
        </div>
      )}
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
    </div>
  );
}
