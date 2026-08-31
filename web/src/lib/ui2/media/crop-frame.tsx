"use client";

// The crop frame — Instagram's model, as the compose wizard rules it: ONE shape
// for the whole post (Tall 4:5, Square 1:1, Wide 1.91:1), with drag-to-move and
// pinch-to-zoom framing per picture. Those two gestures are what the canvas's
// caption promises in as many words, which is why the pinch is implemented here
// rather than left to a control the canvas does not draw.
//
// THE NON-DRAG ROUTE IS KEYBOARD, AND IT IS INVISIBLE ON PURPOSE. design.md §10
// requires every drag gesture to have a non-drag equivalent, and D17 names this
// component. The canvas draws no nudge or zoom controls, and the fix-round-2
// ruling settles the conflict in the canvas's favour: the requirement is met
// without drawing anything. The frame is therefore a focusable control —
//
//   · arrow keys      move the framing by one step
//   · + / = and - / _ zoom in and out by one step
//   · Home            return to the centre at rest
//
// — described to assistive technology by a visually hidden paragraph, so a
// reader who cannot drag is TOLD what to do rather than left to guess at an
// affordance that is not painted. Anyone changing this file: the keyboard route
// is the accessibility requirement, not a convenience. It may not be dropped,
// and `crop-frame.test.tsx` fails if it is.
//
// THE FRAME NEEDS THE PICTURE'S OWN SHAPE. Panning spans the cover overflow
// (see `crop.ts`), which only exists relative to the source's aspect ratio, so
// the natural size is read off the loaded image. Before it loads there is
// nothing to pan across and nothing drawn to pan, which is the same state.

import { useRef, useState } from "react";

import {
  CENTERED,
  canPan,
  cropStyle,
  dragBy,
  NUDGE_STEP,
  ZOOM_STEP,
  nudge,
  zoomBy,
  type Crop,
} from "./crop";
import { AVATAR_RATIO, cssRatio, POST_SHAPES, type PostShape } from "./aspect";

const GUIDE = "rgba(255, 255, 255, 0.55)";

// The frame's shape. A post takes one of the three ruled shapes; the
// profile's avatar is its own fixed frame and is not a post shape (D13).
export type CropFrameShape = PostShape | "avatar";

const SHAPE_RATIO: Record<CropFrameShape, number> = {
  tall: POST_SHAPES.tall.ratio,
  square: POST_SHAPES.square.ratio,
  wide: POST_SHAPES.wide.ratio,
  avatar: AVATAR_RATIO,
};

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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  /** Every pointer currently down, so a second finger can be recognised. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** The finger spread the current zoom was measured from. */
  const pinchRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The source's own width / height, once the browser has decoded it. */
  const [sourceRatio, setSourceRatio] = useState<number | null>(null);

  const frameRatio = SHAPE_RATIO[shape];
  const ratio = sourceRatio ?? frameRatio;
  const pannable = canPan(crop, ratio, frameRatio);

  const spread = (): number | null => {
    const [a, b] = [...pointers.current.values()];
    if (a === undefined || b === undefined) return null;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    const pinch = spread();
    if (pinch !== null) {
      // The second finger takes over: a pinch zooms rather than drags.
      pinchRef.current = pinch;
      dragRef.current = null;
      setDragging(false);
      return;
    }
    if (!pannable) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (frame === null) return;
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    // Pinch first: while two fingers are down there is no drag to apply.
    const started = pinchRef.current;
    if (started !== null) {
      const now = spread();
      if (now !== null && started > 0) {
        onChange(zoomBy(crop, crop.zoom * (now / started) - crop.zoom));
        pinchRef.current = now;
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const rect = frame.getBoundingClientRect();
    onChange(
      dragBy(
        crop,
        event.clientX - drag.x,
        event.clientY - drag.y,
        rect.width,
        rect.height,
        ratio,
        frameRatio,
      ),
    );
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = (dx: number, dy: number) => {
      event.preventDefault();
      onChange(nudge(crop, dx, dy));
    };
    switch (event.key) {
      // Arrow keys move the PICTURE, matching the drag: pressing Left sends the
      // picture left, which brings its right-hand side into the frame.
      case "ArrowLeft":
        return step(NUDGE_STEP, 0);
      case "ArrowRight":
        return step(-NUDGE_STEP, 0);
      case "ArrowUp":
        return step(0, NUDGE_STEP);
      case "ArrowDown":
        return step(0, -NUDGE_STEP);
      case "+":
      case "=":
        event.preventDefault();
        return onChange(zoomBy(crop, ZOOM_STEP));
      case "-":
      case "_":
        event.preventDefault();
        return onChange(zoomBy(crop, -ZOOM_STEP));
      case "Home":
        event.preventDefault();
        return onChange(CENTERED);
      default:
        return;
    }
  };

  const round = shape === "avatar";
  const describedBy = `${testId}-keys`;

  return (
    <>
      <div
        ref={frameRef}
        data-testid={testId}
        // A focusable group rather than a button: it takes keys and reports a
        // value, but activating it does nothing, and a button that ignores
        // Enter would lie about itself.
        role="group"
        tabIndex={0}
        aria-label="The picture's framing"
        aria-describedby={describedBy}
        style={{
          aspectRatio: cssRatio(frameRatio),
          borderRadius: round ? "var(--radius-full)" : "var(--radius-medium)",
          touchAction: "none",
          cursor: pannable ? (dragging ? "grabbing" : "grab") : "default",
        }}
        className="cg-focus relative w-full select-none overflow-hidden bg-surface-container-high"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        {/* A plain <img>, not next/image: the source here is a device-local
            `blob:`/`data:` URL for a file the reader just picked, which the
            optimizer cannot fetch and must not be asked to. next/image is for
            served media; this is a local preview. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              setSourceRatio(image.naturalWidth / image.naturalHeight);
            }
          }}
          style={cropStyle(crop)}
          className="block size-full"
        />
        {/* Rule-of-thirds guides. `aria-hidden` and non-interactive: they are a
            framing aid, not content. Fixed translucent white rather than a
            role — the guides sit on the reader's own photograph, whose tones
            no theme knows, and this is the value the canvas draws. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span style={{ background: GUIDE }} className="absolute inset-y-0 left-1/3 w-px" />
          <span style={{ background: GUIDE }} className="absolute inset-y-0 left-2/3 w-px" />
          <span style={{ background: GUIDE }} className="absolute inset-x-0 top-1/3 h-px" />
          <span style={{ background: GUIDE }} className="absolute inset-x-0 top-2/3 h-px" />
        </span>
      </div>
      <p id={describedBy} className="sr-only">
        Drag the picture to move it, or use the arrow keys. Press plus to zoom in, minus to zoom
        out, and Home to centre it again.
      </p>
    </>
  );
}
