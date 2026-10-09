"use client";

// THE HANDOVER STILL — a clip's new presentation shows the frame its last one
// stopped on while its own element prepares (jakob's hand-test finding 8).
//
// WHY A NEW PRESENTATION CANNOT SHOW THE FRAME ITSELF. Each presentation of a
// clip is its own `<video>` (`video-stage.ts` arbitrates playback, not
// elements), so a card → detail → back swap mounts a fresh element and points
// it at the remembered moment (`clip-memory.ts`). A video decoder can only
// start at a keyframe, so before the element can paint that moment it decodes
// every frame from the keyframe before it — the composer's re-encode keeps
// one keyframe per five seconds (mediabunny's `keyFrameInterval` default,
// which `compress-video.ts` does not override), and a clip uploaded as picked
// keeps its camera's spacing. Until then the element has no frame
// to paint, and a played clip wears no still (FeedCover.md:9), so the frame's
// ground showed through — and an H.264 element may paint frame 0 before its
// seek lands. Measured in headless Chromium: hundreds of milliseconds of
// ground, then sometimes frame 0, then the remembered frame.
//
// SO THE OUTGOING PRESENTATION PICTURES THE FRAME AS IT LEAVES, and the
// incoming one lays that picture over its element until the element can paint
// the same moment itself. Nothing about WHICH clip plays or WHEN changes: the
// still is a picture over the element, never a gate on it — the stage starts
// the element underneath exactly as before.
//
// WHEN THE ELEMENT CAN PAINT IT. "seeked" fires once the seek's new frame is
// available (https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event),
// and `readyState >= HAVE_CURRENT_DATA` says data for the current position is
// there (https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState).
// Available is not yet composited, so the still waits two animation frames
// more before it goes. `requestVideoFrameCallback` names the compositor moment
// exactly, but it was measured to also report frame 0 on an H.264 element, and
// a paused element whose frame was already sent never calls it again — the
// event-plus-two-frames signal measured clean in both cases.
//
// THE PICTURE MAY BE CROSS-ORIGIN, and that is fine for this: a canvas a
// cross-origin video was drawn into is TAINTED, which forbids reading its
// pixels back (`getImageData`, `toBlob`), not displaying it or drawing it into
// another canvas
// (https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image).

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

import * as clipMemory from "./clip-memory";

/** `HTMLMediaElement.HAVE_CURRENT_DATA`, spelled out for environments without the constant. */
const HAVE_CURRENT_DATA = 2;

/**
 * The longest side a picture is kept at. It stands in for well under a second
 * and the session holds a few (`FRAMES_KEPT`), so it is bounded rather than
 * kept at whatever resolution the clip was decoded at.
 */
const LONGEST_SIDE = 1280;

/**
 * A picture of the frame `video` is showing, or null when it has none to give
 * — nothing decoded yet, or a canvas the platform will not draw.
 */
export function pictureOf(video: HTMLVideoElement): HTMLCanvasElement | null {
  const { videoWidth: width, videoHeight: height } = video;
  if (video.readyState < HAVE_CURRENT_DATA || width === 0 || height === 0) return null;
  const scale = Math.min(1, LONGEST_SIDE / Math.max(width, height));
  const picture = document.createElement("canvas");
  picture.width = Math.round(width * scale);
  picture.height = Math.round(height * scale);
  const context = picture.getContext("2d");
  if (!context) return null;
  try {
    context.drawImage(video, 0, 0, picture.width, picture.height);
  } catch {
    return null;
  }
  return picture;
}

/** Whether `video` can paint the moment it stands at. */
function canPaint(video: HTMLVideoElement): boolean {
  return !video.seeking && video.readyState >= HAVE_CURRENT_DATA;
}

/**
 * Whether `video` already paints the pictured moment — it can paint where it
 * stands, AND it stands there.
 *
 * WHERE IT STANDS IS NOT YET THE MOMENT WHEN THE STILL DECIDES. The still is
 * the player's child, so its layout effect runs before the player's own — the
 * one that points the element at the remembered moment. And the element may
 * already have data by then: React creates a host element, `src` and all,
 * while it RENDERS, and a route whose render runs well ahead of its commit (the
 * feed's many cards, on the way back from a detail) hands over an element that
 * has loaded frame 0 of the clip, detached. Asked only whether it can paint,
 * that element says yes — and the still gives way to a seek that has not
 * started, leaving the frame's ground on screen until it lands.
 *
 * The comparison is exact on purpose: the pictured moment is the remembered
 * time (`clipMemory.frameOf`), and an element reads back exactly the time it
 * was pointed at — the same number.
 */
function paintsMoment(video: HTMLVideoElement, moment: number): boolean {
  return canPaint(video) && video.currentTime === moment;
}

/**
 * The remembered frame over a presentation's element, until the element can
 * paint it.
 *
 * Rendered only for a clip the session has seen play — a clip that never
 * played wears its stored still, which is the element's own poster. Whether a
 * picture of the exact moment exists is only known once mounted: the outgoing
 * presentation's goodbye lands in the same commit, after this renders.
 */
export function HandoverStill({
  video,
  mediaId,
  fit,
  testId,
}: {
  video: RefObject<HTMLVideoElement | null>;
  mediaId: string;
  fit: "cover" | "contain";
  testId: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [up, setUp] = useState(true);

  useLayoutEffect(() => {
    if (!up) return;
    const canvas = ref.current;
    const element = video.current;
    const frame = clipMemory.frameOf(mediaId);
    const context = frame && canvas ? canvas.getContext("2d") : null;
    // Nothing pictured, or an element already painting the pictured moment:
    // the element is its own face. Gone before the browser paints, so nothing
    // shows.
    if (!canvas || !element || !frame || !context || paintsMoment(element, frame.time)) {
      setUp(false);
      return;
    }
    canvas.width = frame.picture.width;
    canvas.height = frame.picture.height;
    context.drawImage(frame.picture, 0, 0);

    // FROM HERE ON, ANY MOMENT THE ELEMENT CAN PAINT IS THE SEEK LANDING. The
    // player points the element at the moment in this same commit, and the
    // seek raises `seeking` as it starts (html.spec.whatwg.org, "seek" step 4),
    // so the next time the element can paint, it paints the moment or past it.
    // Settling asks no time on purpose: a looping clip that played on past its
    // end stands before the moment again, and a still that waited for the
    // moment would stand over it for good.
    const pending: number[] = [];
    const settle = () => {
      if (pending.length > 0 || !canPaint(element)) return;
      pending.push(
        requestAnimationFrame(() => {
          pending.push(requestAnimationFrame(() => setUp(false)));
        }),
      );
    };
    // An element that cannot load will never paint the moment: its own face —
    // the frame's ground — is the honest one then.
    const giveWay = () => setUp(false);
    const readiness = ["seeked", "loadeddata", "canplay", "playing", "timeupdate"] as const;
    for (const type of readiness) element.addEventListener(type, settle);
    element.addEventListener("error", giveWay);
    return () => {
      for (const type of readiness) element.removeEventListener(type, settle);
      element.removeEventListener("error", giveWay);
      for (const id of pending) cancelAnimationFrame(id);
    };
  }, [up, video, mediaId]);

  if (!up) return null;
  return (
    <canvas
      ref={ref}
      data-testid={testId}
      aria-hidden="true"
      // The element's own box and fit, so the picture lands exactly where the
      // element will paint the same frame; presses pass through to the element
      // beneath, whose tap reveals the transport or opens the viewer.
      className={[
        "pointer-events-none absolute inset-0 block size-full",
        fit === "contain" ? "object-contain" : "object-cover",
      ].join(" ")}
    />
  );
}
