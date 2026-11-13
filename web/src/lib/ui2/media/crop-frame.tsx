"use client";

// The crop frame — the boarded chrome (ComposeCrop, CoverCrop, AvatarCrop)
// around `react-easy-crop`.
//
// THE ENGINE IS THE LIBRARY, NOT US (jakob, round 5: "i cant imagine that you
// cant find a nice opensource cropping that we can use here"). Its drag, pinch,
// wheel and Safari gesture handling, its bound on the offset and its measured
// rectangle are its own; what lives here is the stage, the frame and the zoom's
// bounds the boards draw, the scrim, the zoom track and the keyboard route.
//
// ONE CROP MODEL (jakob 2026-11-11, seam 301; sizes ComposeCrop.md:7-13,
// CoverCrop.md:11, AvatarCrop.md:7). The STAGE is one size under every shape —
// 390 × 488 for a post and a cover, 390 × 390 for the circle, at the column's
// width (`stageOf`). The FRAME is fixed inside it at the shape (`frameOf`) and
// handed to the library as its `cropSize`, so the window never depends on the
// picture and never moves; the library lays the picture fitted whole into the
// stage and the reader moves and zooms it under the frame, the rest of it in
// view under the scrim. The zoom's floor is the frame's fill and its ceiling
// about 4× (`zoomBounds`): a framing handed in below the floor — the untouched
// `CENTERED`, a picture reshaped while it was not on screen — rises to it the
// moment the picture is measured. (react-easy-crop 6.2.4 README: `cropSize`,
// `minZoom` / `maxZoom`, `objectFit`, `style` / `classes`.)
//
// THE NON-DRAG ROUTE IS OURS TO FINISH (design.md §10: a non-drag equivalent
// for every drag gesture). The K13 round drew it (CropViewport.jsx, jakob
// 2026-10-05):
//
//  · THE ZOOM IS ON SCREEN — `CropZoom`, a range slider under the stage, from
//    the fill to about 4×, because a desktop browser has no pinch. Its value
//    is the zoom as a share of the fill, so its floor reads 1 on every crop.
//  · THE PICTURE PANS BY KEY, under the master's name `Move the picture`: an
//    arrow moves it 1 % of itself, 10 % with Shift, and never past where an
//    edge of the picture meets the frame's (each crop's sidecar). The
//    library's own arrow handling steps in pixels, so the keys are taken here
//    first.
//  · `+`/`-`/`Home` stay as the keyboard's zoom, and a visually hidden
//    paragraph names the keys. `crop-frame.test.tsx` fails if either goes.
//
// THE STAGE IS FULL-BLEED (jakob, round 6: "the area for cropping was to
// small"; every crop board's `margin: 0 -24px`). The `-mx-6` here assumes the
// 24px column every surface holding a cropper has.
//
// THE FRAMING SURVIVES LEAVING THE SCREEN (jakob, round 6). `crop` and `zoom`
// are react-easy-crop's CONTROLLED props, so handing the saved framing to a
// remounted cropper IS the re-seed; the saved `area` is never replayed through
// `initialCroppedAreaPixels`, whose rounding the README warns "may result in a
// slight drifting crop/zoom".

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import Cropper, { type Area, type MediaSize, type Point } from "react-easy-crop";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { useMeasureEffect } from "@/lib/ui/measure-effect";

import {
  CENTERED,
  CROP_STAGE,
  fittedPicture,
  frameOf,
  holdZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  sameCrop,
  stageOf,
  usableArea,
  zoomBounds,
  type Crop,
  type CropKind,
  type Size,
} from "./crop";
import { AVATAR_RATIO, POST_SHAPES, type PostShape } from "./aspect";

// The frame's shape. A post takes one of the three ruled shapes; the
// profile's avatar is its own fixed frame and is not a post shape (D13).
export type CropFrameShape = PostShape | "avatar";

/**
 * A shape no chip offers: a cover's, locked to the clip it fronts — the clip's
 * shape as it stands in a card in a post, the comment pager's square in a
 * comment (CoverCrop.md:3). Given as the ratio itself.
 */
export type LockedRatio = { readonly ratio: number };

function ratioOf(shape: CropFrameShape | LockedRatio): number {
  if (typeof shape !== "string") return shape.ratio;
  return shape === "avatar" ? AVATAR_RATIO : POST_SHAPES[shape].ratio;
}

function kindOf(shape: CropFrameShape | LockedRatio): CropKind {
  if (typeof shape !== "string") return "cover";
  return shape === "avatar" ? "avatar" : "post";
}

/** One press of a zoom key, as a share of the fill. */
const ZOOM_STEP = 0.1;

/**
 * The library's arrow-key step, in pixels — only reached if our own arrow
 * route below has nothing measured yet. Its default of 1 moves the framing
 * by an amount a reader cannot see.
 */
const KEYBOARD_STEP = 8;

/** The measured stage and picture, and what the boards derive from them. */
type Geometry = {
  readonly picture: Size;
  readonly frame: Size;
  readonly floor: number;
  readonly ceiling: number;
};

export function CropFrame({
  src,
  shape,
  crop = CENTERED,
  onChange,
  alt = "",
  zoomSlider = false,
  viewportRef,
  testId = "crop-frame",
  node,
}: {
  src: string;
  shape: CropFrameShape | LockedRatio;
  crop?: Crop;
  onChange: (next: Crop) => void;
  alt?: string;
  /** The stage, for a host that re-frames against its width (`reshape`). */
  viewportRef?: Ref<HTMLDivElement>;
  /** Draws `CropZoom` under the stage (each crop board: "the zoom slider stands under the crop on both platforms"). */
  zoomSlider?: boolean;
  testId?: string;
  /**
   * The registered crop screen (`composeCrop`, `coverCrop`): the stage is its
   * `viewport`, the slider's row its `zoom` and the slider `zoom.input`.
   */
  node?: DataNode;
}) {
  const kind = kindOf(shape);
  const ratio = ratioOf(shape);

  // The library reports position, zoom, and the framed area through three
  // separate callbacks that can fire in one tick. Each merges into the newest
  // value rather than into the one this render closed over, or the second
  // callback would undo the first.
  const latest = useRef(crop);
  useEffect(() => {
    latest.current = crop;
  }, [crop]);

  const emit = useCallback(
    (patch: Partial<Crop>) => {
      const next = { ...latest.current, ...patch };
      // A report that changes nothing is not reported. The cropper re-reports
      // its position on every recompute — including the recompute our own
      // report triggered — so passing an equal-but-new object straight through
      // is an infinite render loop rather than a wasted update.
      if (sameCrop(next, latest.current)) return;
      latest.current = next;
      onChange(next);
    },
    [onChange],
  );

  // THE STAGE'S WIDTH, read off the laid-out stage and kept current by a
  // `ResizeObserver` (MDN): the frame and the zoom's bounds are proportions of
  // it. The ref is the host's too (`viewportRef`).
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  // The host's ref is handed the same element (React: `useImperativeHandle`).
  useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(
    viewportRef as Ref<HTMLDivElement | null> | undefined,
    () => stage,
    [stage],
  );
  useMeasureEffect(() => {
    if (stage === null) return;
    const measure = () => setWidth(stage.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  // The picture's own pixels, as the library read them on load, kept with the
  // source they belong to so a new picture never borrows the last one's.
  const [natural, setNatural] = useState<{ src: string; size: Size } | null>(null);
  const onMediaLoaded = useCallback(
    (media: MediaSize) => setNatural({ src, size: { width: media.naturalWidth, height: media.naturalHeight } }),
    [src],
  );

  const source = natural !== null && natural.src === src ? natural.size : null;
  const geometry = useMemo<Geometry | null>(() => {
    if (!(width > 0) || source === null || !(source.width > 0) || !(source.height > 0)) return null;
    const picture = fittedPicture(source, stageOf(kind, width));
    return { picture, frame: frameSize(kind, ratio, width), ...zoomBounds(kind, picture, ratio, width) };
  }, [width, source, kind, ratio]);

  const zoom = geometry === null ? crop.zoom : holdZoom(crop.zoom, geometry);

  // THE FLOOR HOLDS. A framing below the fill — the untouched one, a picture
  // reshaped unseen, a draft from a wider window — rises to it once the
  // picture is measured; the library then holds the offset to the frame.
  useEffect(() => {
    if (geometry !== null && zoom !== crop.zoom) emit({ zoom });
  }, [geometry, zoom, crop.zoom, emit]);

  const onCropChange = useCallback((point: Point) => emit({ x: point.x, y: point.y }), [emit]);
  const onZoomChange = useCallback(
    (next: number) => emit({ zoom: geometry === null ? next : holdZoom(next, geometry) }),
    [emit, geometry],
  );
  // `croppedAreaPixels` is the rectangle of the SOURCE the frame shows, in the
  // source's own pixels — exactly what the encoder bakes, and independent of
  // the viewport that produced it.
  //
  // A measurement taken before the cropper has a size to measure against — a
  // hidden container, the tick before layout — comes back zeroed or NaN. It is
  // dropped rather than stored: overwriting a good framing with an unusable one
  // would upload a rectangle the author never chose, and a value that is never
  // equal to itself also keeps the report/re-render cycle from ever settling.
  //
  // The percentage half of the same report is kept beside it. It is what lets a
  // thumbnail downstream draw this framing without decoding the picture —
  // see `crop-preview.ts` — and it costs nothing, being already in hand.
  const onCropComplete = useCallback(
    (percent: Area, pixels: Area) => {
      if (!usableArea(pixels)) return;
      emit({ area: pixels, areaPercent: usableArea(percent) ? percent : null });
    },
    [emit],
  );

  const floor = geometry?.floor ?? MIN_ZOOM;
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = ZOOM_STEP * floor;
    const held = (value: number) => (geometry === null ? value : holdZoom(value, geometry));
    switch (event.key) {
      case "+":
      case "=":
        event.preventDefault();
        return emit({ zoom: held(latest.current.zoom + step) });
      case "-":
      case "_":
        event.preventDefault();
        return emit({ zoom: held(latest.current.zoom - step) });
      case "Home":
        event.preventDefault();
        // The area is dropped with the framing: the library measures a fresh
        // one the moment it re-renders centred.
        return emit({ x: 0, y: 0, zoom: floor, area: null, areaPercent: null });
      default:
        return;
    }
  };

  // THE ARROWS ARE TAKEN BEFORE THE LIBRARY SEES THEM (capture phase): its own
  // step is a fixed pixel count, the board's is a share of the picture.
  const onArrow = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const move = ARROWS[event.key];
    if (move === undefined || geometry === null) return;
    event.preventDefault();
    event.stopPropagation();
    const now = latest.current;
    emit(
      panBy(
        { x: now.x, y: now.y, zoom: holdZoom(now.zoom, geometry) },
        move,
        event.shiftKey ? PAN_STEP_SHIFT : PAN_STEP,
        geometry.picture,
        geometry.frame,
      ),
    );
  };

  const board = CROP_STAGE[kind];
  const describedBy = `${testId}-keys`;
  const ceiling = geometry?.ceiling ?? MAX_ZOOM;

  return (
    <>
      {/* No `w-full`: an auto width plus the negative margins is what makes the
          stage the column's width PLUS its padding. */}
      <div
        ref={setStage}
        {...testAttributes(part(node, "viewport"), testId)}
        style={{ aspectRatio: `${board.width} / ${board.height}` }}
        className="relative -mx-6 flex-none overflow-hidden bg-surface-container-high"
        onKeyDown={onKeyDown}
        onKeyDownCapture={onArrow}
      >
        {/* ONE CROPPER PER FRAME (`key`): on a change of its cut the library
            scales the offset by the cut's growth, which keeps a framing
            through a window resize (react-easy-crop 6.2.4
            `recomputeCropPosition`) — on a shape change it would move the
            picture the host has just kept in place (`reshape`). A fresh
            cropper takes the offset it is handed, bounded only. */}
        <Cropper
          key={ratio}
          image={src}
          aspect={ratio}
          // The FIXED frame (`frameOf`): with a `cropSize` the library's window
          // is this size whatever the picture, centred in the stage.
          cropSize={width > 0 ? frameSize(kind, ratio, width) : undefined}
          crop={{ x: crop.x, y: crop.y }}
          zoom={zoom}
          minZoom={floor}
          maxZoom={ceiling}
          cropShape={kind === "avatar" ? "round" : "rect"}
          // The whole picture laid in the stage at 1×; the floor, not this,
          // is what keeps the frame covered.
          objectFit="contain"
          // The rule of thirds is a composition aid for the shape an author
          // chooses (ComposeCrop.md:15); a locked window draws none.
          showGrid={kind === "post"}
          keyboardStep={KEYBOARD_STEP}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
          onMediaLoaded={onMediaLoaded}
          classes={{ cropAreaClassName: `cg-crop-frame cg-crop-frame--${kind}` }}
          mediaProps={{ alt }}
          cropperProps={{ role: "group", "aria-label": CROP_PAN_NAME, "aria-describedby": describedBy }}
        />
      </div>
      <p id={describedBy} className="sr-only">
        Drag the picture to move it, or use the arrow keys. Press plus to zoom in, minus to zoom
        out, and Home to centre it again.
      </p>
      {/* `CropZoom` (CropViewport.jsx): the drawn track (`.cg-range`,
          `CROP_ZOOM_CSS`) at the column's width, 48px tall so the thumb's
          target is the minimum, no words beside it — its name says what it
          does. Its value is the zoom as a share of the fill. */}
      {zoomSlider && (
        <ZoomTrack
          value={zoom / floor}
          max={ceiling / floor}
          onChange={(share) => emit({ zoom: geometry === null ? share * floor : holdZoom(share * floor, geometry) })}
          node={node}
          testId={testId}
        />
      )}
    </>
  );
}

/** The frame's size before the picture is measured — the stage's, not the picture's. */
function frameSize(kind: CropKind, ratio: number, width: number): Size {
  const frame = frameOf(kind, ratio, width);
  return { width: frame.width, height: frame.height };
}

function ZoomTrack({
  value,
  max,
  onChange,
  node,
  testId,
}: {
  value: number;
  max: number;
  onChange: (share: number) => void;
  node?: DataNode;
  testId: string;
}) {
  const at = max > MIN_ZOOM ? ((value - MIN_ZOOM) / (max - MIN_ZOOM)) * 100 : 0;
  return (
    <div className="flex-none" {...testAttributes(part(node, "zoom"))}>
      <input
        type="range"
        {...testAttributes(part(node, "zoom.input"), `${testId}-zoom`)}
        min={MIN_ZOOM}
        max={max}
        step={0.01}
        value={value}
        aria-label={CROP_ZOOM_NAME}
        onChange={(event) => onChange(Number(event.target.value))}
        className="cg-focus cg-range m-0 block h-12 w-full flex-none"
        style={{ "--cg-range-at": `${Math.min(100, Math.max(0, at)).toFixed(2)}%` } as React.CSSProperties}
      />
    </div>
  );
}

/** The stage's and the slider's spoken names (CropViewport.jsx; blessed, jakob 2026-10-05). */
export const CROP_PAN_NAME = "Move the picture";
export const CROP_ZOOM_NAME = "Zoom";

/** One arrow press moves the picture this share of itself; Shift, ten times it. */
const PAN_STEP = 0.01;
const PAN_STEP_SHIFT = 0.1;

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * The framing one arrow press leaves: the picture moved `share` of its own
 * rendered size along `move`, held where its edge meets the frame's — the
 * library's own bound (`restrictPosition`: |offset| ≤ |picture · zoom − frame| / 2).
 * `picture` is the library's 1× lay, `crop.zoom` already held to the bounds.
 */
export function panBy(
  crop: Pick<Crop, "x" | "y" | "zoom">,
  move: readonly [number, number],
  share: number,
  picture: Size,
  frame: Size,
): { x: number; y: number } {
  const { zoom } = crop;
  const bound = (laid: number, window: number) => Math.abs((laid * zoom) / 2 - window / 2);
  const hold = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
  return {
    x: hold(crop.x + move[0] * share * picture.width * zoom, bound(picture.width, frame.width)),
    y: hold(crop.y + move[1] * share * picture.height * zoom, bound(picture.height, frame.height)),
  };
}
