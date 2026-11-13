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
// ONE CROP MODEL, EVERY CROP (jakob 2026-11-11, seam 301: "fixed frame with
// mooving and zooming image"; sizes ComposeCrop.md, CoverCrop.md, AvatarCrop.md).
// Each crop has ONE STAGE that never changes size with the shape, and a FIXED
// FRAME of the shape centred in it; the picture moves and zooms under the
// frame and the rest of it stays in view under the scrim. The library lays the
// picture fitted whole into the stage ("contain") at zoom 1, so the stage's
// size, not the frame's, is what a zoom is relative to — which is why a shape
// switch can keep the zoom and the offset as they are: the picture does not
// move, only the frame around it changes. The zoom's floor is the frame's FILL
// (the picture just covers the frame), never the contained 1×.

import { POST_SHAPES } from "./aspect";

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
  /**
   * The library's zoom: the picture's scale over its whole-picture fit in the
   * stage. Held between the frame's fill and about 4× of it (`zoomBounds`).
   */
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

/**
 * The zoom track's two ends, as shares of the frame's fill: the floor is the
 * fill itself, the ceiling about 4× (CropViewport.jsx `CROP_ZOOM_MIN` /
 * `CROP_ZOOM_MAX`; each crop's sidecar).
 */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/**
 * Untouched. Its zoom of 1 is the whole picture in the stage, under the floor
 * of almost every frame: the frame raises it to the fill on first sight.
 */
export const CENTERED: Crop = { x: 0, y: 0, zoom: 1, area: null, areaPercent: null };

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, value));
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
 * The picture as the library lays it at 1× in the stage — react-easy-crop
 * 6.2.4 `computeSizes`, `objectFit: "contain"`: fitted whole into the box, and never
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
 * Which crop a stage belongs to: the post's (three shapes, chosen), a video's
 * cover (the clip's shape, locked) or the profile picture (the circle).
 */
export type CropKind = "post" | "cover" | "avatar";

/**
 * The boards' stages at their 390 artboard — one per crop, the same under
 * every shape (ComposeCrop.md:7, CoverCrop.md:11, AvatarCrop.md:7). On a
 * wider column the stage keeps this proportion at the column's width.
 */
export const CROP_STAGE: Readonly<Record<CropKind, Size>> = {
  post: { width: 390, height: 488 },
  cover: { width: 390, height: 488 },
  avatar: { width: 390, height: 390 },
};

/**
 * The column's gutter. The post's frame spans the stage; the cover's and the
 * circle stand between the gutters (CropViewport.jsx `inset`).
 */
export const CROP_GUTTER = 24;

/** A frame inside its stage: where it stands and how large it is, in CSS pixels. */
export type Frame = Size & { readonly left: number; readonly top: number };

/** The stage at `width`, in the board's proportion. */
export function stageOf(kind: CropKind, width: number): Size {
  const board = CROP_STAGE[kind];
  return { width, height: (width * board.height) / board.width };
}

/**
 * The fixed frame of `ratio` (width ÷ height) in a stage `stageWidth` wide:
 * the stage's full width for a post, the width between the gutters for a
 * cover or the circle, at the ratio EXACTLY — what is cut is what is uploaded,
 * so the frame never rounds to a board's whole pixel — and centred.
 * A ratio too tall for the stage stands at the stage's height instead.
 */
export function frameOf(kind: CropKind, ratio: number, stageWidth: number): Frame {
  const stage = stageOf(kind, stageWidth);
  const across = kind === "post" ? stageWidth : stageWidth - 2 * CROP_GUTTER;
  const width = Math.min(across, stage.height * ratio);
  const height = width / ratio;
  return { width, height, left: (stageWidth - width) / 2, top: (stage.height - height) / 2 };
}

/** The zoom at which the laid picture just covers the frame. */
export function fillOf(picture: Size, frame: Size): number {
  return Math.max(frame.width / picture.width, frame.height / picture.height);
}

/** Where a crop's zoom may stand, in the library's units. */
export type ZoomBounds = { readonly floor: number; readonly ceiling: number };

/**
 * The zoom's floor and ceiling for a picture laid `picture` (the library's 1×
 * fit, `fittedPicture`) under the frame of `ratio`.
 *
 * The floor is the frame's fill: nothing outside the picture can show inside
 * the frame. The ceiling is about 4× — of the TALLEST frame the stage holds on
 * a post, so that a shape switch, which may only ever raise the zoom
 * (ComposeCrop.md:19-21), never meets a ceiling below where the picture
 * stands. A cover and the circle have one frame, so theirs is 4× their fill.
 */
export function zoomBounds(kind: CropKind, picture: Size, ratio: number, stageWidth: number): ZoomBounds {
  const floor = fillOf(picture, frameOf(kind, ratio, stageWidth));
  const tallest = kind === "post" ? fillOf(picture, frameOf(kind, POST_SHAPES.tall.ratio, stageWidth)) : floor;
  return { floor, ceiling: MAX_ZOOM * Math.max(floor, tallest) };
}

/** A zoom held between the bounds; a value that is not a number stands at the floor. */
export function holdZoom(zoom: number, bounds: ZoomBounds): number {
  return clamp(zoom, bounds.floor, bounds.ceiling);
}

/**
 * The offset held where an edge of the picture meets the frame's — the
 * library's own bound (`restrictPosition`: |offset| ≤ |picture · zoom − frame| / 2).
 */
export function holdOffset(
  offset: { readonly x: number; readonly y: number },
  picture: Size,
  frame: Size,
  zoom: number,
): { x: number; y: number } {
  const hold = (value: number, laid: number, window: number) => {
    const limit = Math.abs((laid * zoom) / 2 - window / 2);
    return Math.max(-limit, Math.min(limit, value));
  };
  return { x: hold(offset.x, picture.width, frame.width), y: hold(offset.y, picture.height, frame.height) };
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
 * The framing a picture keeps when the post's shape changes to ratio `to`:
 * the frame changes around the picture, never the picture (ComposeCrop.md:19-23).
 *
 * THE STAGE DOES NOT CHANGE, so the picture's laid size does not either, and
 * the zoom and the offset — the picture's centre from the stage's, in CSS
 * pixels — simply stay. Only the new frame's own bounds move them, each by the
 * least it asks: the zoom rises to the new frame's fill where it stood below
 * it (never further, and never down), and the offset shifts just enough that
 * no edge of the picture comes inside the frame.
 *
 * The measured rectangle always goes: it is the old shape's (`area` above).
 * Without a measurement or a stage width there is nothing to measure the
 * bounds against; the zoom and offset stay, and the frame holds them to the
 * new bounds the moment the picture is on screen again.
 */
export function reshape(crop: Crop, to: number, stageWidth: number | null): Crop {
  const kept: Crop = { ...crop, area: null, areaPercent: null };
  const source = sourceOf(crop);
  if (source === null || stageWidth === null || !(stageWidth > 0)) return kept;
  const picture = fittedPicture(source, stageOf("post", stageWidth));
  const bounds = zoomBounds("post", picture, to, stageWidth);
  // The ceiling is the same under every post shape (`zoomBounds`), so holding
  // the zoom can only ever raise it here.
  const zoom = holdZoom(crop.zoom, bounds);
  return { ...kept, zoom, ...holdOffset(crop, picture, frameOf("post", to, stageWidth), zoom) };
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
