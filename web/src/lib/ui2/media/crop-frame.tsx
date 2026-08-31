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
// THE NON-DRAG ROUTE IS STILL OURS TO FINISH, AND IT IS INVISIBLE ON PURPOSE.
// design.md §10 requires a non-drag equivalent for every drag gesture, and the
// fix-round-2 ruling forbids drawing nudge or zoom controls. The library brings
// half of it — its cropper is focusable and the arrow keys move the framing by
// `keyboardStep` — but it has no keyboard route for ZOOM, and pinch-to-zoom is
// a gesture like any other. So `+`/`-`/`Home` are handled here, on top, and a
// visually hidden paragraph TELLS a reader the keys rather than leaving them to
// guess at an affordance that is not painted. Anyone changing this file: the
// keyboard zoom is the accessibility requirement, not a convenience, and
// `crop-frame.test.tsx` fails if it goes.

import { useCallback, useEffect, useRef } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";

import { CENTERED, clampZoom, MAX_ZOOM, MIN_ZOOM, sameCrop, usableArea, type Crop } from "./crop";
import { AVATAR_RATIO, cssRatio, POST_SHAPES, type PostShape } from "./aspect";

// The frame's shape. A post takes one of the three ruled shapes; the
// profile's avatar is its own fixed frame and is not a post shape (D13).
export type CropFrameShape = PostShape | "avatar";

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
  testId = "crop-frame",
}: {
  src: string;
  shape: CropFrameShape;
  crop?: Crop;
  onChange: (next: Crop) => void;
  alt?: string;
  testId?: string;
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
  const onCropComplete = useCallback(
    (_percent: Area, pixels: Area) => {
      if (!usableArea(pixels)) return;
      emit({ area: pixels });
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
        return emit({ x: 0, y: 0, zoom: MIN_ZOOM, area: null });
      default:
        // Arrows belong to the library; swallowing them here would take the
        // keyboard route away rather than add to it.
        return;
    }
  };

  const round = shape === "avatar";
  const describedBy = `${testId}-keys`;

  return (
    <>
      <div
        data-testid={testId}
        style={{
          aspectRatio: cssRatio(SHAPE_RATIO[shape]),
          borderRadius: round ? "var(--radius-full)" : "var(--radius-medium)",
        }}
        className="relative w-full overflow-hidden bg-surface-container-high"
        onKeyDown={onKeyDown}
      >
        <Cropper
          image={src}
          aspect={SHAPE_RATIO[shape]}
          crop={{ x: crop.x, y: crop.y }}
          zoom={clampZoom(crop.zoom)}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          cropShape={round ? "round" : "rect"}
          // The whole picture, always. This one prop is the first of the two
          // reported defects; it is not a taste setting.
          objectFit="contain"
          // The rule-of-thirds guides the canvas draws are the library's own.
          showGrid
          keyboardStep={KEYBOARD_STEP}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
          mediaProps={{ alt }}
          cropperProps={{ "aria-label": "The picture's framing", "aria-describedby": describedBy }}
        />
      </div>
      <p id={describedBy} className="sr-only">
        Drag the picture to move it, or use the arrow keys. Press plus to zoom in, minus to zoom
        out, and Home to centre it again.
      </p>
    </>
  );
}
