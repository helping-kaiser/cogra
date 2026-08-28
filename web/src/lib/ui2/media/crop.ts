// The crop model, as pure functions — no DOM, so the framing rules are
// testable without rendering anything.
//
// THE MODEL: a zoom factor and a focal point. The picture is first fitted to
// COVER the frame, then scaled by `zoom` about the focal point, so the focal
// point is the part of the picture that stays put as the reader zooms. That is
// the same shape the design canvas draws (`object-fit: cover` plus a `scale`
// and a `transform-origin`), and it has a property worth having: with the
// picture cover-fitted first, EVERY focal point in the unit square keeps the
// frame covered, so there is no reachable state with a bar of background
// showing. The clamp is therefore the unit square itself rather than a
// zoom-dependent box, which is what makes nudging predictable at every zoom.

export type Crop = {
  /** >= 1. At exactly 1 the picture fits the frame and cannot be panned. */
  zoom: number;
  /** The focal point, in fractions of the frame. 0.5/0.5 is centred. */
  x: number;
  /** Ditto, vertically. */
  y: number;
};

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** One press of a zoom control. */
export const ZOOM_STEP = 0.1;

/** One press of a nudge control, in fractions of the pannable range. */
export const NUDGE_STEP = 0.05;

export const CENTERED: Crop = { zoom: 1, x: 0.5, y: 0.5 };

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, value));
}

export function clampCrop(crop: Crop): Crop {
  const zoom = clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM);
  // At zoom 1 there is nothing to pan to, so the focal point collapses to the
  // centre rather than keeping a value the reader cannot see the effect of.
  if (zoom === MIN_ZOOM) return { zoom, x: 0.5, y: 0.5 };
  return { zoom, x: clamp(crop.x, 0, 1), y: clamp(crop.y, 0, 1) };
}

export function zoomBy(crop: Crop, delta: number): Crop {
  return clampCrop({ ...crop, zoom: crop.zoom + delta });
}

export function nudge(crop: Crop, dx: number, dy: number): Crop {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

/**
 * Convert a pointer drag in CSS pixels into a new crop.
 *
 * Dragging RIGHT moves the picture right, which reveals more of its left side —
 * so the focal point moves left. The pannable distance is `frame * (zoom - 1)`,
 * which is why a drag at zoom 1 does nothing: there is no slack to take up.
 */
export function dragBy(
  crop: Crop,
  dxPixels: number,
  dyPixels: number,
  frameWidth: number,
  frameHeight: number,
): Crop {
  const slack = crop.zoom - 1;
  if (slack <= 0 || frameWidth <= 0 || frameHeight <= 0) return crop;
  return nudge(crop, -dxPixels / (frameWidth * slack), -dyPixels / (frameHeight * slack));
}

/** The inline style that renders a crop: what the component hands to the img. */
export function cropStyle(crop: Crop): {
  transform: string;
  transformOrigin: string;
  objectFit: "cover";
} {
  const safe = clampCrop(crop);
  return {
    transform: `scale(${safe.zoom})`,
    transformOrigin: `${safe.x * 100}% ${safe.y * 100}%`,
    objectFit: "cover",
  };
}

/** Whether the reader can pan at all — drives the disabled state of the nudges. */
export function canPan(crop: Crop): boolean {
  return clampCrop(crop).zoom > MIN_ZOOM;
}
