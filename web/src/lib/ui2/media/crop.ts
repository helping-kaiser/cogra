// The crop model — the two numbers the cropper is driven by, and the one
// rectangle the encoder bakes.
//
// THE ENGINE IS `react-easy-crop`, NOT THIS FILE (D20's standard: the most
// used, best suited, maintained library). What lives here is only the shape of
// the state the wizard carries between screens and into the draft:
//
//   · `x`, `y`, `zoom` — the library's own controlled inputs. `x`/`y` are the
//     media's offset in CONTAINER pixels, which is the library's coordinate
//     system, not ours; nothing outside the frame should interpret them.
//   · `area` — the framed rectangle of the SOURCE, in the source's own pixels,
//     handed back by `onCropComplete`. This is the only part the encoder reads,
//     and being in source pixels makes it independent of the viewport that
//     produced it — a draft framed on a phone still encodes correctly when it
//     is restored in a wider window.
//
// WHY THE OLD FOCAL-POINT MODEL IS GONE. It cover-fitted the picture to the
// frame, so at rest a wide photograph in a 4:5 frame showed a vertical slice
// and the rest of the picture was simply not on screen — the reader could not
// see what they were choosing between. The library's default `objectFit`
// ("contain") shows the picture WHOLE and puts the crop rectangle inside it,
// which is the behaviour the hand test asked for, and the crop rectangle is
// recomputed from the media whenever the shape changes — so switching shape
// re-frames against the original picture rather than against the last crop.

/** A rectangle of the source picture, in the source's own pixels. */
export type CropArea = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type Crop = {
  /** The library's media offset, in container pixels. Opaque outside the frame. */
  readonly x: number;
  readonly y: number;
  /** Between `MIN_ZOOM` and `MAX_ZOOM`. */
  readonly zoom: number;
  /**
   * What the frame currently shows, in source pixels. Null until the picture
   * has been decoded and measured — `encodeForUpload` falls back to the
   * centred rectangle, which is exactly what the frame shows at rest.
   */
  readonly area: CropArea | null;
};

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export const CENTERED: Crop = { x: 0, y: 0, zoom: MIN_ZOOM, area: null };

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, value));
}

/** Guards the zoom the library is handed; the offset is the library's to bound. */
export function clampZoom(zoom: number): number {
  return clamp(zoom, MIN_ZOOM, MAX_ZOOM);
}

/**
 * Whether two framings are the same framing.
 *
 * NOT a nicety: the cropper re-reports its position whenever it recomputes —
 * on every re-render, including the one our own report caused. Handing back a
 * fresh object each time makes that a state change, the state change makes
 * another render, and the render makes another report; React stops it with
 * "Maximum update depth exceeded". Comparing by value is what closes the loop.
 */
export function sameCrop(a: Crop, b: Crop): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.zoom === b.zoom &&
    (a.area === b.area ||
      (a.area !== null &&
        b.area !== null &&
        a.area.x === b.area.x &&
        a.area.y === b.area.y &&
        a.area.width === b.area.width &&
        a.area.height === b.area.height))
  );
}

/**
 * Whether a stored area can still be used to encode.
 *
 * A zero-width rectangle would produce a canvas that cannot be drawn, and an
 * area measured before the picture was decoded can arrive that way.
 */
export function usableArea(area: CropArea | null | undefined): area is CropArea {
  return (
    area !== null &&
    area !== undefined &&
    Number.isFinite(area.x) &&
    Number.isFinite(area.y) &&
    Number.isFinite(area.width) &&
    Number.isFinite(area.height) &&
    area.width > 0 &&
    area.height > 0
  );
}
