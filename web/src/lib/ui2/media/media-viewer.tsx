"use client";

// THE FULLSCREEN MEDIA VIEWER (`design/components/media/MediaViewer.jsx`;
// boards `ViewerPicture`, `ViewerVideo`, `ViewerLandscape`). DV-01 / H-25.
//
// IT IS THE WHOLE SURFACE, ON BLACK, WITH NOTHING BEHIND IT (`:12-14`). "Not a
// scrim over the post: a viewer you can still read a card through is not full
// screen, and the ground has to be black so the frame's own edges are the only
// edges." The master says `position: absolute` because a board renders inside a
// phone frame; on a real page the same rule is `fixed` — the surface is the
// SCREEN, not the scroll container it was opened from.
//
// THE FRAME IS NEVER CUT HERE (`:15-17`). `contain`, centred, as large as the
// surface allows — "a viewer that crops is not a viewer. This is the surface
// the feed card's 4:5 clamp exists against: whatever a card crops, the viewer
// restores."
//
// THE STAGE IS POSITIONED, NEVER FLEX-SIZED (`:18-24`). The media fills an
// absolutely inset box and is fitted inside it, "so containment never depends
// on the frame's own proportions". The master records what breaks otherwise: a
// percentage `max-height` against an indefinite height pushed the transport off
// the screen entirely.
//
// IT IS A PLACE YOU BACK OUT OF (`:25-29`): an X, a swipe DOWN, Escape, and the
// backdrop all close it, and it never changes the underlying route. "The X
// rather than a back arrow, because the reader is dismissing a layer, not
// walking a step of a journey."
//
// A PICTURE PINCH-ZOOMS, AND THE GALLERY'S SWIPE CARRIES OVER (`:30-34`): the
// set is paged here exactly as in the card, DOTS AND ALL — dots only, no arrows
// (item 21's pager ruling), the row windowed at seven (item 67), and the count
// in the accessible name rather than on the frame.
//
// A VIDEO TAKES THE FULL TRANSPORT (`:39-41`) — the ladder's third rung, the
// same component the detail's pinned clip wears, with the same stop-at-end
// grammar. Rotating the device fills the screen with it, which is the device's
// own gesture, so there is no rotate control to draw.
//
// NO ACTS AND NO DESCRIPTION (`:42-47`). Acting on a post happens where the
// post is, and "a viewer that grows a toolbar is a viewer nobody trusts to
// close"; alt text is written for people who cannot see the frame, and printing
// it here would turn a description into a caption its author never wrote.
//
// FOCUS IS TRAPPED, because this is a modal dialog and the WAI-ARIA dialog
// pattern requires it: focus moves into the dialog on open, Tab cycles inside
// it, and it returns to what opened it on close
// (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). The X is what takes
// focus first — the way out is the first thing a keyboard reader lands on.

import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/lib/ui/icons";
import type { GalleryItem } from "./media-gallery";
import { PagerDots } from "./pager-dots";
import { isVideoAsset } from "./media-tile";
import { GESTURE_ZONE } from "./video-transport";
import { VideoPlayer } from "./video-player";

/** How far a drag has to travel before it is a gesture rather than a tap. */
const SWIPE_THRESHOLD = 48;

/** How much taller than wide a drag must be to read as a dismiss rather than a
 * page turn. A diagonal belongs to neither, and guessing at one is what makes a
 * gesture surface feel like it is fighting the thumb. */
const AXIS_BIAS = 1.4;

/** Zoom bounds. One is the frame whole — the viewer's own promise — and four is
 * far enough to read a face in a group shot without turning the picture into
 * pixels. Under 1 would shrink a frame that is already fitted, which is nothing
 * the reader asked for. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export type ViewerItem = Pick<GalleryItem, "src" | "altText" | "poster" | "durationMs"> & {
  mimeType: string;
};

export function MediaViewer({
  items,
  index = 0,
  onClose,
  testId = "media-viewer",
}: {
  items: readonly ViewerItem[];
  index?: number;
  onClose: () => void;
  testId?: string;
}) {
  const [current, setCurrent] = useState(index);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // What had focus when the viewer opened. The dialog pattern returns focus
  // there on close; without it a reader who dismisses the viewer is dropped at
  // the top of the document.
  const openerRef = useRef<Element | null>(null);

  const count = items.length;
  const item = items[Math.min(current, Math.max(count - 1, 0))];

  // A STEP IS RELATIVE TO WHERE THE PAGER IS, never to the rendered index —
  // the same rule the transport's skips follow (`video-player.tsx`, `skipBy`).
  // Two presses land inside one render, so a second step computed from the
  // index this render closed over would move from where the first one started
  // rather than from where it arrived.
  const move = useCallback(
    (delta: number) => {
      if (count < 2) return;
      // The master wraps (`MediaViewer.jsx:70` — `(next + count) % count`): the
      // set is a ring here, the same way the card's strip is a ring under a
      // repeated swipe.
      setCurrent((at) => (((at + delta) % count) + count) % count);
    },
    [count],
  );

  // `index` is WHERE THE VIEWER OPENS, not a controlled position: once it is
  // up, the pager is the reader's. The master syncs the two with an effect
  // because a board re-renders with a new index under a live canvas; here the
  // layer is mounted by the surface that opens it and unmounted when it
  // closes, so the state is initialised from the prop and owned from then on —
  // which is also what React's own guidance asks for (react.dev, "You Might Not
  // Need an Effect": a state that mirrors a prop is a render, not an effect).

  // FOCUS IN, AND FOCUS BACK OUT.
  useEffect(() => {
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key !== "Tab") return;
      // THE TRAP. Everything focusable in the dialog, in document order; Tab off
      // either end wraps to the other, so focus never leaves the layer while it
      // is up.
      const surface = surfaceRef.current;
      if (!surface) return;
      const focusable = surface.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !surface.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, onClose]);

  if (!item) return null;

  const video = isVideoAsset(item.mimeType);

  return (
    <div
      ref={surfaceRef}
      role="dialog"
      aria-modal="true"
      aria-label="Media"
      data-testid={testId}
      // THE BACKDROP CLOSES IT (`MediaViewer.jsx:136`, graph.json ViewerPicture
      // via 3). The stage below stops the press, so only a tap on the ground
      // reaches this.
      onClick={onClose}
      className="fixed inset-0 z-[60] overflow-hidden"
      style={{ background: "#000" }}
    >
      {/* THE STAGE. Absolutely inset, the frame fitted inside it — so what is
          drawn is bounded by the screen whatever shape the frame is. The
          click-stop keeps a tap ON the media from closing what was just
          opened. */}
      <ViewerStage
        key={current}
        item={item}
        video={video}
        onClose={onClose}
        onStep={move}
        testId={testId}
      />

      {/* THE DOT ROW, windowed at seven and in the viewer's tone (item 67),
          held clear of the gesture zone the transport's bar also respects. */}
      {count > 1 && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[3] flex justify-center"
          style={{ bottom: `${GESTURE_ZONE}px` }}
        >
          <PagerDots count={count} current={current} tone="viewer" testId={`${testId}-dots`} />
        </div>
      )}

      {/* THE WAY OUT. Top-left, over the frame: "the chrome belongs to the
          surface, not to the picture" (`MediaViewer.jsx:167-168`). */}
      <div className="absolute left-0 top-0 z-[3] flex items-center p-2">
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          data-testid={`${testId}-close`}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="cg-state cg-focus grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0"
          style={{
            width: "var(--touch-target-min)",
            height: "var(--touch-target-min)",
            color: "#fff",
            filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
          }}
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}

/**
 * One item on the black ground, and the gestures over it.
 *
 * Keyed by page in the parent, so a swipe to the next picture lands on a fresh
 * stage: the zoom belongs to the picture being looked at, and carrying a 3×
 * magnification onto the next frame would be the viewer deciding what the
 * reader wanted to see.
 */
function ViewerStage({
  item,
  video,
  onClose,
  onStep,
  testId,
}: {
  item: ViewerItem;
  video: boolean;
  onClose: () => void;
  onStep: (delta: number) => void;
  testId: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Live pointers, by id. Two of them are a pinch; one is a drag. Pointer
  // Events are what make this one code path for touch, pen and mouse
  // (https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ spread: number; zoom: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      pinchStart.current = { spread: spread(), zoom };
      dragStart.current = null;
    } else if (pointers.current.size === 1) {
      dragStart.current = { x: event.clientX, y: event.clientY, pan };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // A PICTURE PINCH-ZOOMS (`MediaViewer.jsx:30`). The ratio of the current
    // spread to the spread the gesture started at IS the scale: it makes the
    // picture track the fingers exactly, where a per-event delta drifts.
    const pinch = pinchStart.current;
    if (pointers.current.size === 2 && pinch && pinch.spread > 0) {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (spread() / pinch.spread) * pinch.zoom));
      setZoom(next);
      // Back at 1 the frame is whole again and there is nothing to be panned
      // off-centre, so the pan goes with the zoom rather than being left behind.
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      return;
    }

    // ZOOMED IN, ONE FINGER PANS. The page turn and the dismiss both belong to
    // the frame at rest: a reader who magnified a picture is moving around
    // inside it, and taking that drag for a swipe would make the zoom unusable.
    const drag = dragStart.current;
    if (drag && zoom > MIN_ZOOM) {
      setPan({
        x: drag.pan.x + (event.clientX - drag.x),
        y: drag.pan.y + (event.clientY - drag.y),
      });
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const from = pointers.current.get(event.pointerId);
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;

    const drag = dragStart.current;
    dragStart.current = null;
    if (!from || !drag || zoom > MIN_ZOOM) return;

    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const [across, down] = [Math.abs(dx), Math.abs(dy)];

    // THE SWIPE DOWN DISMISSES (`MediaViewer.jsx:25-29`, graph ViewerPicture
    // via 1) — down only: a swipe up is the gesture a scroller owns, and this
    // surface does not scroll. The axis bias is what keeps a diagonal from
    // being read as both.
    if (down > SWIPE_THRESHOLD && down > across * AXIS_BIAS) {
      if (dy > 0) onClose();
      return;
    }
    // AND THE GALLERY'S SWIPE CARRIES OVER (`:30-31`): the set pages here
    // exactly as it does in the card.
    if (across > SWIPE_THRESHOLD && across > down * AXIS_BIAS) {
      onStep(dx < 0 ? 1 : -1);
    }
  };

  return (
    <div
      data-testid={`${testId}-stage`}
      // The stage is the frame's own ground: a press here must not reach the
      // backdrop, which closes.
      onClick={(event) => event.stopPropagation()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute inset-0"
      // The browser's own pan and zoom are turned off because the gestures
      // above are the surface's: left on, a pinch would scroll the page under
      // the viewer instead of magnifying the picture.
      style={{ touchAction: "none" }}
    >
      {video ? (
        <div className="absolute inset-0">
          {/* THE LADDER'S THIRD RUNG. The same transport the detail's pinned
              clip wears, over a clip that stops at its end rather than looping
              — the reader opened this one on purpose, twice over.

              IT CLAIMS THE STAGE, WHICH IS THE HANDOVER. One clip plays at a
              time (FE-28), so the viewer arriving pauses the pinned clip it was
              opened from rather than playing a second copy of it over the
              first. Each `<video>` here owns its own decode — `video-stage.ts`
              arbitrates playback ownership and deliberately does not pool
              players the way Android's `VideoStage` does — so the clip starts
              at the top rather than where the detail had it. */}
          <VideoPlayer
            src={item.src ?? ""}
            poster={item.poster}
            altText={item.altText}
            durationMs={item.durationMs}
            surface="transport"
            framed
            // THE FRAME IS NEVER CUT HERE (`MediaViewer.jsx:15-17`).
            fit="contain"
            testId={`${testId}-video`}
          />
        </div>
      ) : (
        // A PLAIN `img`, not next/image: the viewer shows the stored rendition
        // at whatever size the screen gives it, which is the one case the
        // optimizer's fixed `sizes` cannot describe — and the bytes are
        // display-ready by construction (see `media-tile.tsx`).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.src ?? ""}
          alt={item.altText ?? ""}
          aria-hidden={item.altText ? undefined : "true"}
          data-testid={`${testId}-picture`}
          className="absolute inset-0 size-full"
          style={{
            objectFit: "contain",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            // The gesture is direct manipulation: a transition here would make
            // the picture lag the fingers moving it.
            transformOrigin: "center",
          }}
        />
      )}
    </div>
  );
}
