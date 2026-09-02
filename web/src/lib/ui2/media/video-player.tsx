"use client";

// The feed's video: autoplay muted when it comes into view, real controls, and
// the one global mute.
//
// AUTOPLAY IS ONLY EVER MUTED, and that is a platform rule rather than a taste.
// MDN: "Autoplay blocking is not applied to <video> elements when the source
// media does not have an audio track, or if the audio track is muted… Inaudible
// media are not affected by autoplay blocking."
// (https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) Chrome
// states it more bluntly still — "Muted autoplay is always allowed"
// (https://developer.chrome.com/blog/autoplay/). So the element starts muted,
// and sound is something the reader turns on.
//
// AND THE PLAY CALL CAN STILL BE REFUSED. `play()` returns a promise that
// rejects — `NotAllowedError` — when the browser declines, so the rejection is
// handled rather than left to become an unhandled rejection in the console. A
// refused autoplay is not an error state for the reader: the poster is showing,
// the controls are there, and pressing play works.
//
// VISIBILITY DRIVES PLAYBACK via IntersectionObserver, which is the documented
// way to react to an element entering the viewport
// (https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver) and
// costs nothing per frame, unlike a scroll handler. A clip that scrolls away
// pauses rather than stopping: coming back should resume where the reader was,
// not restart.
//
// THE MUTE IS BOUND BOTH WAYS. The element's own controls carry a mute button,
// so the reader's press arrives as a `volumechange` on the element rather than
// as a click this component sees. Reading it back into the shared store is what
// makes the native control the global control — otherwise the one affordance a
// reader actually reaches for would be the one that does not stick.
//
// `prefers-reduced-motion` STOPS THE AUTOPLAY. Video that starts by itself is
// motion the reader did not ask for, and the reduced-motion preference is the
// standing request not to be shown it. The clip still plays on a press.

import { useEffect, useRef } from "react";

import { formatDuration } from "./video";
import { isMuted, setMuted, useMuted } from "./mute";

/** Enough of the frame in view to be worth playing — half, so two clips never fight. */
const VISIBLE_ENOUGH = 0.5;

export function VideoPlayer({
  src,
  poster,
  altText,
  durationMs,
  testId = "video-player",
  autoplay = true,
}: {
  src: string;
  /** The video's face. Null when there is none, or when it was redacted. */
  poster?: string | null;
  altText?: string | null;
  durationMs?: number | null;
  testId?: string;
  autoplay?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const muted = useMuted();

  // The store is the truth; the element follows it. Written through the
  // property rather than the attribute because the attribute is only the
  // initial value once the element exists.
  useEffect(() => {
    const video = ref.current;
    if (video && video.muted !== muted) video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !autoplay) return;
    if (typeof IntersectionObserver === "undefined") return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Muted at the moment of the call, not merely at mount: a reader
            // who left the sound on is still governed by the same store, and an
            // unmuted autoplay would simply be refused.
            video.muted = isMuted();
            void video.play().catch(() => {
              // NotAllowedError, or a decode this browser cannot start. The
              // poster stays, the controls stay, and nothing is said — a
              // refusal here is the browser's policy, not a fault the reader
              // can act on.
            });
          } else if (!video.paused) {
            video.pause();
          }
        }
      },
      { threshold: VISIBLE_ENOUGH },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [autoplay, src]);

  return (
    <span className="relative block w-full">
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        // Every one of these is load-bearing: `muted` is what makes autoplay
        // permitted at all, `playsInline` is what stops iOS taking the clip
        // fullscreen, `loop` is the short-form idiom the feed is built on, and
        // `preload="metadata"` keeps a feed of ten clips from pulling ten
        // videos down before any of them is on screen.
        muted
        playsInline
        loop
        controls
        preload="metadata"
        aria-label={altText ?? undefined}
        data-testid={testId}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        className="block max-h-[var(--media-max-height)] w-full bg-surface-container-high"
      />
      {typeof durationMs === "number" && durationMs > 0 && (
        <span
          data-testid={`${testId}-duration`}
          // Top, not bottom: the element's own control bar owns the bottom edge
          // and a badge there would sit under the reader's thumb.
          className="pointer-events-none absolute right-2 top-2 rounded-extra-small bg-scrim/55 px-2 py-px text-label-small text-white"
        >
          {formatDuration(durationMs)}
        </span>
      )}
    </span>
  );
}
