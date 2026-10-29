"use client";

// The crop frame — the boarded chrome (ComposeCrop) around `react-easy-crop`.
//
// THE ENGINE IS THE LIBRARY, NOT US (jakob, round 5: "i cant imagine that you
// cant find a nice opensource cropping that we can use here"). The hand-rolled
// focal-point cropper this replaces had two defects that were properties of its
// model rather than bugs on top of it:
//
//   · it cover-fitted the picture to the frame, so at rest a wide photograph in
//     a 4:5 frame showed a vertical slice and the rest of the picture was never
//     drawn — the reader could not see what they were choosing between; and
//   · every re-frame was expressed against that already-trimmed window.
//
// `react-easy-crop` defaults `objectFit` to "contain": the picture is shown
// WHOLE and the crop rectangle is computed from the MEDIA and laid inside it.
// So the full picture renders at rest, every section is reachable, and changing
// the shape recomputes that rectangle against the original picture rather than
// against the previous crop. Both defects die by construction, which is why the
// library replaces the model and not just the gestures.
//
// THE NON-DRAG ROUTE IS OURS TO FINISH (design.md §10: a non-drag equivalent
// for every drag gesture). The K13 round drew it (CropViewport.jsx, jakob
// 2026-10-05), superseding the earlier ruling that kept it invisible:
//
//  · THE ZOOM IS ON SCREEN — `CropZoom`, a range slider under the cut, between
//    the fill and about 4×, because a desktop browser has no pinch. A crop
//    asks for it with `zoomSlider`.
//  · THE CUT PANS BY KEY, under the master's name `Move the picture`: an arrow
//    moves the picture 1 % of itself, 10 % with Shift, and never past where an
//    edge of the picture meets the cut's (ComposeCrop.md). The library's own
//    arrow handling steps in pixels, so the keys are taken here first.
//  · `+`/`-`/`Home` stay as the keyboard's zoom, and a visually hidden
//    paragraph names the keys. `crop-frame.test.tsx` fails if either goes.
//
// THE FRAME IS FULL-BLEED (jakob, round 6: "the area for cropping was to
// small"). ComposeCrop and AvatarCrop both draw the viewport edge to edge —
// `margin: 0 -24px` out of the 24px column, and no rounded corners, because a
// bled frame has no corners to round. The `-mx-6` here assumes exactly that
// column, which is what every surface holding a cropper has.
//
// THE FRAMING SURVIVES LEAVING THE SCREEN (jakob, round 6: "when returning to
// the crop section ... the crop should be 'remembered'"). `crop` and `zoom` are
// react-easy-crop's CONTROLLED props — the README's props table calls `crop`
// required and says `{ x: 0, y: 0 }` centres the media — so the cropper shows
// whatever it is handed, and handing it the saved framing on a remount IS the
// re-seed. That is also why the saved `area` is not fed back through
// `initialCroppedAreaPixels`: the same README warns that `croppedAreaPixels` is
// rounded and "may result in a slight drifting crop/zoom" when used to restore,
// and recommends the percentages instead. Driving the controlled props avoids
// the round trip altogether. (react-easy-crop 6.2.3, `README.md` — the props
// table and `initialCroppedAreaPercentages`.)

import { useCallback, useEffect, useRef } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

import { CENTERED, clampZoom, MAX_ZOOM, MIN_ZOOM, sameCrop, usableArea, type Crop } from "./crop";
import { AVATAR_RATIO, cssRatio, POST_SHAPES, type PostShape } from "./aspect";

// The frame's shape. A post takes one of the three ruled shapes; the
// profile's avatar is its own fixed frame and is not a post shape (D13).
export type CropFrameShape = PostShape | "avatar";

/**
 * A shape no chip offers: a cover's, locked to the clip it fronts — the clip's
 * own ratio in a post, the comment pager's square in a comment (CoverCrop.md).
 * Given as the ratio itself, since a clip's is any ratio. Its frame is
 * `CropViewport`'s square, the cut a window inside it with the rest darkened —
 * the avatar's construction, which the cover's crop is (CoverCrop.jsx).
 */
export type LockedRatio = { readonly ratio: number };

function ratioOf(shape: CropFrameShape | LockedRatio): number {
  return typeof shape === "string" ? SHAPE_RATIO[shape] : shape.ratio;
}

const SHAPE_RATIO: Record<CropFrameShape, number> = {
  tall: POST_SHAPES.tall.ratio,
  square: POST_SHAPES.square.ratio,
  wide: POST_SHAPES.wide.ratio,
  avatar: AVATAR_RATIO,
};

/** One press of a zoom key. The library's own arrow step is in pixels. */
const ZOOM_STEP = 0.1;

/**
 * The library's arrow-key step, in pixels. Its default is 1, which moves the
 * framing by an amount a reader cannot see — a keyboard route nobody can tell
 * is working is not a route.
 */
const KEYBOARD_STEP = 8;

export function CropFrame({
  src,
  shape,
  crop = CENTERED,
  onChange,
  alt = "",
  zoomSlider = false,
  testId = "crop-frame",
  node,
}: {
  src: string;
  shape: CropFrameShape | LockedRatio;
  crop?: Crop;
  onChange: (next: Crop) => void;
  alt?: string;
  /** Draws `CropZoom` under the cut (ComposeCrop: "the zoom slider stands under the crop on both platforms"). */
  zoomSlider?: boolean;
  testId?: string;
  /**
   * The registered crop screen (`composeCrop`, `coverCrop`): the frame is its
   * `viewport`, the slider's row its `zoom` and the slider `zoom.input`.
   */
  node?: DataNode;
}) {
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

  const onCropChange = useCallback((point: Point) => emit({ x: point.x, y: point.y }), [emit]);
  const onZoomChange = useCallback((zoom: number) => emit({ zoom: clampZoom(zoom) }), [emit]);
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

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "+":
      case "=":
        event.preventDefault();
        return emit({ zoom: clampZoom(latest.current.zoom + ZOOM_STEP) });
      case "-":
      case "_":
        event.preventDefault();
        return emit({ zoom: clampZoom(latest.current.zoom - ZOOM_STEP) });
      case "Home":
        event.preventDefault();
        // The area is dropped with the framing: the library measures a fresh
        // one the moment it re-renders centred.
        return emit({ x: 0, y: 0, zoom: MIN_ZOOM, area: null, areaPercent: null });
      default:
        return;
    }
  };

  // The rendered picture and the cut, as the library measures them — what a
  // key's 1 % is of, and where the picture's edge meets the cut's.
  const media = useRef<{ width: number; height: number } | null>(null);
  const cut = useRef<{ width: number; height: number } | null>(null);

  // THE ARROWS ARE TAKEN BEFORE THE LIBRARY SEES THEM (capture phase): its own
  // step is a fixed pixel count, the board's is a share of the picture.
  const onArrow = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const move = ARROWS[event.key];
    if (move === undefined || media.current === null || cut.current === null) return;
    event.preventDefault();
    event.stopPropagation();
    const now = latest.current;
    emit(panBy(now, move, event.shiftKey ? PAN_STEP_SHIFT : PAN_STEP, media.current, cut.current));
  };

  const round = shape === "avatar";
  const describedBy = `${testId}-keys`;

  return (
    <>
      {/* No `w-full`: an auto width plus the negative margins is what makes the
          frame the column's width PLUS its padding. A fixed 100% would only
          shift the frame sideways. The avatar's frame is not itself a circle —
          the library draws the round crop area and the scrim around it, which
          is what AvatarCrop boards. */}
      <div
        {...testAttributes(part(node, "viewport"), testId)}
        style={{ aspectRatio: cssRatio(typeof shape === "string" ? SHAPE_RATIO[shape] : 1) }}
        className="relative -mx-6 overflow-hidden bg-surface-container-high"
        onKeyDown={onKeyDown}
        onKeyDownCapture={onArrow}
      >
        <Cropper
          image={src}
          aspect={ratioOf(shape)}
          crop={{ x: crop.x, y: crop.y }}
          zoom={clampZoom(crop.zoom)}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          cropShape={round ? "round" : "rect"}
          // The whole picture, always. This one prop is the first of the two
          // reported defects; it is not a taste setting.
          objectFit="contain"
          // The rule-of-thirds guides the canvas draws are the library's own. A
          // locked window draws none: `CropViewport` is a window and a mask, the
          // guides being a composition aid for the shape an author chooses.
          showGrid={typeof shape === "string"}
          keyboardStep={KEYBOARD_STEP}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
          onMediaLoaded={(size) => {
            media.current = { width: size.width, height: size.height };
          }}
          onCropSizeChange={(size) => {
            cut.current = size;
          }}
          mediaProps={{ alt }}
          cropperProps={{ role: "group", "aria-label": CROP_PAN_NAME, "aria-describedby": describedBy }}
        />
      </div>
      <p id={describedBy} className="sr-only">
        Drag the picture to move it, or use the arrow keys. Press plus to zoom in, minus to zoom
        out, and Home to centre it again.
      </p>
      {/* `CropZoom` (CropViewport.jsx): the house slider in `primary` at the
          column's width, 48px tall so the thumb's target is the minimum, no
          words beside it — its name says what it does. */}
      {zoomSlider && (
        <div className="flex-none" {...testAttributes(part(node, "zoom"))}>
          <input
            type="range"
            {...testAttributes(part(node, "zoom.input"), `${testId}-zoom`)}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={clampZoom(crop.zoom)}
            aria-label={CROP_ZOOM_NAME}
            onChange={(event) => emit({ zoom: clampZoom(Number(event.target.value)) })}
            className="cg-focus m-0 block h-12 w-full flex-none accent-primary"
          />
        </div>
      )}
    </>
  );
}

/** The cut's and the slider's spoken names (CropViewport.jsx; blessed, jakob 2026-10-05). */
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
 * rendered size along `move`, held where its edge meets the cut's — the
 * library's own bound (`restrictPosition`: |offset| ≤ |picture · zoom − cut| / 2).
 */
export function panBy(
  crop: Pick<Crop, "x" | "y" | "zoom">,
  move: readonly [number, number],
  share: number,
  media: { width: number; height: number },
  cut: { width: number; height: number },
): { x: number; y: number } {
  const zoom = clampZoom(crop.zoom);
  const bound = (picture: number, window: number) => Math.abs((picture * zoom) / 2 - window / 2);
  const hold = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
  return {
    x: hold(crop.x + move[0] * share * media.width * zoom, bound(media.width, cut.width)),
    y: hold(crop.y + move[1] * share * media.height * zoom, bound(media.height, cut.height)),
  };
}
