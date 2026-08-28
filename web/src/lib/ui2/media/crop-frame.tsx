"use client";

// The crop frame — Instagram's model, as the compose wizard rules it: ONE shape
// for the whole post (Tall 4:5, Square 1:1, Wide 1.91:1), with drag-to-move and
// zoom framing per picture.
//
// THE NON-DRAG ROUTE IS NOT OPTIONAL. design.md §10: "every drag gesture has a
// non-drag equivalent", and D17 names this component specifically — the crop
// step must be completable without a gesture. So the pointer drag is one input
// and the discrete nudge/zoom controls are another, both writing the same
// model, and the controls are REAL BUTTONS on screen rather than a hidden
// keyboard affordance: a reader who cannot drag needs to see that there is
// another way, and the crop screen has the room the feed card does not.
//
// The canvas draws the caption "One shape for the whole post. Drag to move,
// pinch to zoom." and does not draw these controls — they are the accessibility
// requirement, added deliberately and flagged as a divergence from the drawing.

import { useRef, useState } from "react";

import {
  CENTERED,
  canPan,
  cropStyle,
  dragBy,
  MAX_ZOOM,
  MIN_ZOOM,
  NUDGE_STEP,
  ZOOM_STEP,
  nudge,
  zoomBy,
  type Crop,
} from "./crop";
import { AVATAR_RATIO, COVER_RATIO, cssRatio, POST_SHAPES, type PostShape } from "./aspect";

const GUIDE = "rgba(255, 255, 255, 0.55)";

// The frame's shape. A post takes one of the three ruled shapes; an avatar and
// a cover are their own fixed frames and are not post shapes (D13).
export type CropFrameShape = PostShape | "avatar" | "cover";

const SHAPE_RATIO: Record<CropFrameShape, number> = {
  tall: POST_SHAPES.tall.ratio,
  square: POST_SHAPES.square.ratio,
  wide: POST_SHAPES.wide.ratio,
  avatar: AVATAR_RATIO,
  cover: COVER_RATIO,
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
  const [dragging, setDragging] = useState(false);

  const pannable = canPan(crop);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pannable) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || drag.id !== event.pointerId || !frame) return;
    const rect = frame.getBoundingClientRect();
    onChange(
      dragBy(crop, event.clientX - drag.x, event.clientY - drag.y, rect.width, rect.height),
    );
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  const round = shape === "avatar";

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frameRef}
        data-testid={testId}
        style={{
          aspectRatio: cssRatio(SHAPE_RATIO[shape]),
          borderRadius: round ? "var(--radius-full)" : "var(--radius-medium)",
          touchAction: "none",
          cursor: pannable ? (dragging ? "grabbing" : "grab") : "default",
        }}
        className="relative w-full overflow-hidden bg-surface-container-high select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
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

      <p className="m-0 text-body-small text-on-surface-variant">
        One shape for the whole post. Drag to move, or use the controls.
      </p>

      {/* The non-drag equivalent (design.md §10, D17). Grouped and labelled so
          it reads as one control rather than five loose buttons. */}
      <div
        role="group"
        aria-label="Framing"
        data-testid={`${testId}-controls`}
        className="flex items-center gap-2"
      >
        <NudgeButton
          testId={`${testId}-left`}
          label="Move the picture left"
          disabled={!pannable}
          onPress={() => onChange(nudge(crop, NUDGE_STEP, 0))}
        >
          <ArrowGlyph rotate={180} />
        </NudgeButton>
        <NudgeButton
          testId={`${testId}-right`}
          label="Move the picture right"
          disabled={!pannable}
          onPress={() => onChange(nudge(crop, -NUDGE_STEP, 0))}
        >
          <ArrowGlyph rotate={0} />
        </NudgeButton>
        <NudgeButton
          testId={`${testId}-up`}
          label="Move the picture up"
          disabled={!pannable}
          onPress={() => onChange(nudge(crop, 0, NUDGE_STEP))}
        >
          <ArrowGlyph rotate={-90} />
        </NudgeButton>
        <NudgeButton
          testId={`${testId}-down`}
          label="Move the picture down"
          disabled={!pannable}
          onPress={() => onChange(nudge(crop, 0, -NUDGE_STEP))}
        >
          <ArrowGlyph rotate={90} />
        </NudgeButton>

        <span className="flex-1" />

        <NudgeButton
          testId={`${testId}-zoom-out`}
          label="Zoom out"
          disabled={crop.zoom <= MIN_ZOOM}
          onPress={() => onChange(zoomBy(crop, -ZOOM_STEP))}
        >
          <span aria-hidden="true">−</span>
        </NudgeButton>
        <NudgeButton
          testId={`${testId}-zoom-in`}
          label="Zoom in"
          disabled={crop.zoom >= MAX_ZOOM}
          onPress={() => onChange(zoomBy(crop, ZOOM_STEP))}
        >
          <span aria-hidden="true">+</span>
        </NudgeButton>
      </div>
    </div>
  );
}

function NudgeButton({
  children,
  label,
  testId,
  disabled,
  onPress,
}: {
  children: React.ReactNode;
  label: string;
  testId: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className="cg-state cg-focus flex size-12 items-center justify-center rounded-full border border-outline text-on-surface-variant disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ArrowGlyph({ rotate }: { rotate: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="currentColor"
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M4 13h12.17l-5.59 5.59L12 20l8-8-8-8-1.42 1.41L16.17 11H4v2z" />
    </svg>
  );
}
