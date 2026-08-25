// Where the bloomed pad sits (design.md §8.3).
//
// "The pad lives at one fixed spot: the lower centre of the viewport —
// the thumb-comfort zone — the same place every time, regardless of
// which control opened it. Muscle memory is part of the control; a pad
// that appears somewhere new on every press cannot be operated without
// looking."
//
// So the pad is not measured against anything. It is PARKED: fixed
// positioning, centred horizontally, held off the bottom edge. Nothing
// here reads a DOMRect, which is the point — an anchored surface has to
// re-measure on resize, rotation, and the on-screen keyboard, and each
// of those is a chance for the pad to move. A parked pad cannot move,
// because there is no measurement for a viewport change to invalidate.
//
// The knob still starts at the field's origin and the drag is still
// accumulated travel (`pad-geometry.ts`), so the finger's absolute
// position never mattered anyway: the pad does not need to be near the
// press to be usable, and being in the same place every time is worth
// more than being near it.
//
// `pad-placement.ts` still anchors the COACH MARK, which §8.7 keeps
// against the target it teaches about.

import type { CSSProperties } from "react";

/** How far the pad's bottom edge sits above the viewport's, in pixels. */
export const PAD_PARK_INSET_PX = 16;

/**
 * The parked pad's style. `bottom` rather than `top` is what makes it
 * the LOWER centre on any viewport height without arithmetic, and the
 * translate is what centres a fixed box whose width the caller owns.
 *
 * The height cap is the one concession to small viewports: a pad taller
 * than the screen would otherwise run off the top, where the parking
 * rule has nothing to say. It scrolls inside itself instead of moving.
 */
export function parkedPadStyle(inset: number = PAD_PARK_INSET_PX): CSSProperties {
  return {
    position: "fixed",
    left: "50%",
    bottom: `${inset}px`,
    transform: "translateX(-50%)",
    maxHeight: `calc(100dvh - ${inset * 2}px)`,
  };
}
