// The crop model, as pure functions — no DOM, so the framing rules are
// testable without rendering anything.
//
// THE MODEL: a zoom factor and a focal point, where the focal point names a
// point of the SOURCE PICTURE — 0.5/0.5 is its middle, 0/0 its top-left corner.
// The picture is cover-fitted to the frame and then scaled by `zoom` about that
// point, so the point stays put as the reader zooms.
//
// WHY THE FOCAL POINT IS A POINT OF THE SOURCE, not of the zoom's slack. A
// frame's shape rarely matches the picture's, so cover-fitting already throws
// away a band of the picture before any zooming happens: a 4:5 frame over a
// wide photograph shows a vertical slice, a 1.91:1 frame over a tall one shows
// a horizontal band. WHICH slice is a framing decision the author has to be
// able to make — and at zoom 1 there is no zoom slack to express it with. So
// the focal point pans across the COVER OVERFLOW, which exists at every zoom
// including 1, and the zoom's own slack simply adds to it. That is what makes
// every section of every picture reachable at every ratio.
//
// The rendering follows from the same two numbers: `object-fit: cover` with an
// `object-position` at the focal point puts the right slice in the frame, and a
// `scale` about a `transform-origin` at the same point zooms without moving it.
// `sourceRect` in `encode-image.ts` inverts exactly this, so the bytes that
// upload are the bytes the author framed.

export type Crop = {
  /** >= 1. At exactly 1 the picture is cover-fitted and only the overflow pans. */
  zoom: number;
  /** The focal point, as a fraction of the source's width. 0.5 is its middle. */
  x: number;
  /** Ditto, of its height. */
  y: number;
};

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** One press of a zoom control. */
export const ZOOM_STEP = 0.1;

/** One press of a nudge control, as a fraction of the source. */
export const NUDGE_STEP = 0.05;

export const CENTERED: Crop = { zoom: 1, x: 0.5, y: 0.5 };

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, value));
}

export function clampCrop(crop: Crop): Crop {
  // The focal point keeps its value at every zoom, zoom 1 included: at zoom 1
  // it still chooses which band of an off-shape picture the frame shows.
  return {
    zoom: clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM),
    x: clamp(crop.x, 0, 1),
    y: clamp(crop.y, 0, 1),
  };
}

/**
 * How much of each source axis the frame shows, as a fraction of that axis.
 *
 * `sourceRatio` and `frameRatio` are both width / height. At zoom 1 the axis
 * the cover fit trims comes back below 1 and the other comes back exactly 1;
 * zooming shrinks both.
 */
export function visibleFraction(
  sourceRatio: number,
  frameRatio: number,
  zoom: number,
): { x: number; y: number } {
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  if (!Number.isFinite(sourceRatio) || sourceRatio <= 0 || !Number.isFinite(frameRatio) || frameRatio <= 0) {
    return { x: 1 / z, y: 1 / z };
  }
  // A source proportionally wider than the frame has its WIDTH trimmed.
  const wider = sourceRatio > frameRatio;
  return {
    x: Math.min(1, (wider ? frameRatio / sourceRatio : 1) / z),
    y: Math.min(1, (wider ? 1 : sourceRatio / frameRatio) / z),
  };
}

/**
 * The travel available on each axis, as a fraction of the source. Zero means
 * that axis is shown whole and there is nothing to pan to.
 */
export function panRange(
  sourceRatio: number,
  frameRatio: number,
  zoom: number,
): { x: number; y: number } {
  const visible = visibleFraction(sourceRatio, frameRatio, zoom);
  return { x: Math.max(0, 1 - visible.x), y: Math.max(0, 1 - visible.y) };
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
 * so the focal point moves left. One unit of focal point spans `panRange` of
 * the source shown through a window of `visibleFraction`, which is what turns
 * screen pixels into source fractions.
 */
export function dragBy(
  crop: Crop,
  dxPixels: number,
  dyPixels: number,
  frameWidth: number,
  frameHeight: number,
  sourceRatio: number,
  frameRatio: number,
): Crop {
  if (frameWidth <= 0 || frameHeight <= 0) return crop;
  const visible = visibleFraction(sourceRatio, frameRatio, crop.zoom);
  const range = panRange(sourceRatio, frameRatio, crop.zoom);
  const dx = range.x > 0 ? (-dxPixels * visible.x) / (frameWidth * range.x) : 0;
  const dy = range.y > 0 ? (-dyPixels * visible.y) / (frameHeight * range.y) : 0;
  return nudge(crop, dx, dy);
}

/**
 * Rounded to four places before it reaches the DOM. Stepping by 0.05 lands on
 * values like 0.55000000000000004, and a seventeen-digit percentage in an
 * inline style is noise — four places is far finer than a device pixel.
 */
function trim(value: number): number {
  return Number(value.toFixed(4));
}

/** The inline style that renders a crop: what the component hands to the img. */
export function cropStyle(crop: Crop): {
  transform: string;
  transformOrigin: string;
  objectFit: "cover";
  objectPosition: string;
} {
  const safe = clampCrop(crop);
  const at = `${trim(safe.x * 100)}% ${trim(safe.y * 100)}%`;
  return {
    transform: `scale(${trim(safe.zoom)})`,
    transformOrigin: at,
    objectFit: "cover",
    objectPosition: at,
  };
}

/**
 * Whether the reader can pan at all — false only when the picture is already
 * shown whole, which is the square-source-in-square-frame case at zoom 1.
 */
export function canPan(crop: Crop, sourceRatio: number, frameRatio: number): boolean {
  const range = panRange(sourceRatio, frameRatio, clampCrop(crop).zoom);
  return range.x > 0 || range.y > 0;
}
