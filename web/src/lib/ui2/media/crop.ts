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
//   · `areaPercent` — the SAME rectangle as a fraction of the picture, the
//     library's other half of `onCropComplete`. Two units for one rectangle is
//     not duplication: source pixels are meaningless to a RENDERER, which has
//     no way to learn how many pixels wide the source is, while percentages
//     are meaningless to the ENCODER, which draws in source pixels. Held
//     together, the pair also yields the source's own extent
//     (`area.width * 100 / areaPercent.width`), which is what lets a thumbnail
//     anywhere downstream show the framing without decoding the picture first.
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
  /**
   * The same rectangle as a fraction of the picture, 0–100. Null alongside
   * `area`, and dropped with it whenever the shape changes.
   */
  readonly areaPercent: CropArea | null;
};

export const MIN_ZOOM = 1;
/** About 4× — the crop's ceiling (CropViewport.jsx `CROP_ZOOM_MAX`; ComposeCrop.md). */
export const MAX_ZOOM = 4;

export const CENTERED: Crop = { x: 0, y: 0, zoom: MIN_ZOOM, area: null, areaPercent: null };

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
    sameArea(a.area, b.area) &&
    sameArea(a.areaPercent, b.areaPercent)
  );
}

function sameArea(a: CropArea | null, b: CropArea | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** A width and a height — CSS pixels for the frame, the source's own for a picture. */
export type Size = { readonly width: number; readonly height: number };

/**
 * The picture as the frame lays it at 1× — react-easy-crop 6.2.4
 * `computeSizes`, `objectFit: "contain"`: fitted whole into the box, and never
 * scaled past its own pixels (a picture smaller than the box stands at its own
 * size).
 */
export function fittedPicture(source: Size, box: Size): Size {
  if (source.width <= box.width && source.height <= box.height) return source;
  const aspect = source.width / source.height;
  return box.width / box.height > aspect
    ? { width: box.height * aspect, height: box.height }
    : { width: box.width, height: box.width / aspect };
}

/**
 * The cut — the library's `getCropSize`: the largest rectangle of the shape's
 * ratio inside both the fitted picture and the box.
 */
export function cutOf(picture: Size, box: Size, ratio: number): Size {
  const width = Math.min(picture.width, box.width);
  const height = Math.min(picture.height, box.height);
  return width > height * ratio ? { width: height * ratio, height } : { width, height: width / ratio };
}

/**
 * The source's own extent, read back off the measured rectangle: the same cut
 * in source pixels and as a share of the picture (`areaPercent`'s note above).
 * Null until the frame has measured the picture.
 */
export function sourceOf(crop: Crop): Size | null {
  const { area, areaPercent } = crop;
  if (!usableArea(area) || !usableArea(areaPercent)) return null;
  return { width: (area.width * 100) / areaPercent.width, height: (area.height * 100) / areaPercent.height };
}

/**
 * The framing a picture keeps when the post's shape changes from ratio `from`
 * to ratio `to`: the shape changes around the picture, never the picture.
 *
 * WHY THE ZOOM MOVES. A post's viewport takes the shape's own ratio at the
 * frame's full width, and the library lays the picture at 1× to fit that box —
 * so at an unchanged zoom a wide box draws a portrait picture at less than
 * half the size a tall one does (hand test 2026-11-11: "when swapping from tall
 * to square or wide the image shrinks"). The zoom is rescaled so the picture
 * stands at the size it stood, and the offset — the picture's centre from the
 * box's, in CSS pixels — stays, so the new shape is centred on what the old
 * one was.
 *
 * ONLY THE CROP'S OWN BOUNDS MOVE THEM (ComposeCrop.md:29 — never below the
 * fill or past about 4×): the zoom is held between the two, and the offset
 * where an edge of the picture meets the cut's (the library's
 * `restrictPosition`), each by the least that bound asks.
 *
 * The measured rectangle always goes: it is the old shape's (`area` above).
 * Without a measurement or a frame width there is nothing to keep the picture
 * at, and the position and zoom stay as they were.
 */
export function reshape(crop: Crop, from: number, to: number, frameWidth: number | null): Crop {
  const kept: Crop = { ...crop, area: null, areaPercent: null };
  const source = sourceOf(crop);
  if (source === null || frameWidth === null || !(frameWidth > 0) || from === to) return kept;
  const box = (ratio: number): Size => ({ width: frameWidth, height: frameWidth / ratio });
  const before = fittedPicture(source, box(from));
  const after = fittedPicture(source, box(to));
  const zoom = clampZoom((clampZoom(crop.zoom) * before.width) / after.width);
  const cut = cutOf(after, box(to), to);
  const hold = (offset: number, picture: number, window: number) => {
    const limit = Math.abs((picture * zoom) / 2 - window / 2);
    return Math.max(-limit, Math.min(limit, offset));
  };
  return { ...kept, zoom, x: hold(crop.x, after.width, cut.width), y: hold(crop.y, after.height, cut.height) };
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
