"use client";

// The feed's video: autoplay muted when it comes into view, the sound disc
// every card wears, and the one global mute.
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
// THE MUTE IS BOUND BOTH WAYS. Nothing but this component's own sound disc
// changes `.muted` today, but a `volumechange` can still arrive from outside
// it — the browser's picture-in-picture window carries its own mute control —
// so reading it back into the shared store is what keeps an out-of-band mute
// from silently diverging from what every other player on screen shows.
//
// `prefers-reduced-motion` STOPS THE AUTOPLAY. Video that starts by itself is
// motion the reader did not ask for, and the reduced-motion preference is the
// standing request not to be shown it. The clip still plays on a press.

import { useEffect, useRef, useState } from "react";

import { isMuted, setMuted, useMuted } from "./mute";
import { formatDuration } from "./video";
import { VideoTransport } from "./video-transport";
import { claim, surrender } from "./video-stage";

/** Enough of the frame in view to be worth playing — android's gate, blessed
 * (design/readme.md: "One clip plays at a time, at 70% visibility or more"). */
const VISIBLE_ENOUGH = 0.7;

/**
 * How much of a player a surface gets — the control ladder, as a type
 * (design/readme.md, "The control ladder").
 *
 * `reading` is the comment's form (design/backlog.md item 31, round 2 point 2,
 * drawn by ReplyMedia): the clip wears ONE control — the sound — and no
 * play/pause and no duration pill. A comment is something you read past, not a
 * player you operate, and a transport bar on a 220px square inside a thread is
 * more chrome than content. The sound still has to be reachable, because
 * autoplay is muted and a reader must be able to hear what was posted.
 *
 * `full` is the feed card's, and it wears the same one control: "a feed card
 * wears the sound control and nothing else — no play/pause, no duration pill,
 * at both scales". Presence on screen is the whole policy there.
 *
 * `transport` is the ladder's second rung — the post detail's pinned clip, and
 * the fullscreen viewer after it. The reader opened this clip on purpose, so
 * the transport is real: play/pause, the skips, and a timeline that takes a tap
 * anywhere or a drag along it. The sound moves INTO the bar there, which is why
 * the disc is not drawn beside it.
 */
export type PlayerSurface = "full" | "reading" | "transport";

/** How long the chrome stays up after the reader last touched it. The board
 * draws the revealed state because "a board of the hidden state is a board of a
 * video" (`VideoControls.jsx:35-37`); this is the hide it auto-hides on. */
const CHROME_LINGER_MS = 3_000;

export function VideoPlayer({
  src,
  poster,
  altText,
  testId = "video-player",
  autoplay = true,
  surface = "full",
  framed = false,
  fit = "cover",
  onOpenViewer,
  durationMs,
}: {
  src: string;
  /** The video's face. Null when there is none, or when it was redacted. */
  poster?: string | null;
  altText?: string | null;
  /** The record's own running time. No surface wears a duration PILL; the
   * transport's bar draws the total, and this is what it shows until the
   * element's own metadata lands with the authoritative number. */
  durationMs?: number | null;
  testId?: string;
  autoplay?: boolean;
  surface?: PlayerSurface;
  /**
   * Whether the caller reserved a frame for the clip to fill. Framed, the
   * element takes its parent's box whole; unframed it sizes itself, full
   * width, at whatever height its own ratio gives it.
   */
  framed?: boolean;
  /**
   * How the clip meets its frame.
   *
   * `cover` is the media law and the default: a clip keeps its native ratio
   * clamped to tall and "letterboxing exists nowhere" (the reel round). THE
   * FULLSCREEN VIEWER IS THE ONE EXCEPTION, and it is the rule's other half —
   * "the frame is never cut here… this is the surface the feed card's 4:5 clamp
   * exists against" (`MediaViewer.jsx:15-17`). `ViewerLandscape.jsx:5-9` states
   * the contrast outright: a 16:9 clip fills the height and leaves ground at
   * the sides, because "a card is a layout, and this is the frame itself".
   */
  fit?: "cover" | "contain";
  /**
   * The way into the fullscreen viewer, where the surface has one.
   *
   * The graph draws TWO routes there from the video detail — "the transport's
   * own way into the viewer — the clip tap is the other" (graph.json,
   * `PostDetailVideo` via 19 and via 3) — and both land here: the bar grows its
   * fullscreen toggle, and a tap on the clip WHILE THE CHROME IS UP opens the
   * viewer instead of hiding it.
   *
   * That second half is a reading of two drawn edges onto one gesture. The
   * chrome hides itself after three seconds over a running clip, so binding the
   * clip tap to the viewer outright would strand the transport with no way
   * back; binding it only once the controls are already visible keeps the
   * reveal tap intact and still gives the clip its own route in.
   */
  onOpenViewer?: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const muted = useMuted();
  const transport = surface === "transport";
  // The clip's own clock, read off the element rather than held beside it: the
  // element is the truth about where playback is, and a second copy ticking on
  // its own would disagree with it the moment a seek or a stall happened.
  const [playing, setPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lengthSec, setLengthSec] = useState<number | null>(null);
  // The chrome is drawn revealed and hides itself; a tap on the video brings it
  // back (`design/designs/canonical/screens/PostDetailVideo.jsx:13-15`).
  const [chromeShown, setChromeShown] = useState(true);
  // Identity, not value: the stage tells surfaces apart by object identity
  // (mirroring VideoStage.kt's `token: Any`). `useState`'s lazy initializer
  // runs once and its result is stable across re-renders — unlike
  // `useRef({}).current`, it never reads a ref during render, which React's
  // own lint rule (react-hooks/refs) forbids.
  const [stageToken] = useState(() => ({}));

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
            // Claim the stage before playing — one clip plays at a time, so
            // claiming pauses whatever this replaces (FE-28).
            claim(stageToken, video);
            // Muted at the moment of the call, not merely at mount: a reader
            // who left the sound on is still governed by the same store, and an
            // unmuted autoplay would simply be refused.
            video.muted = isMuted();
            void video.play().catch(() => {
              // NotAllowedError, or a decode this browser cannot start. The
              // poster stays, the sound disc stays, and nothing is said — a
              // refusal here is the browser's policy, not a fault the reader
              // can act on.
            });
          } else {
            if (!video.paused) video.pause();
            surrender(stageToken);
          }
        }
      },
      { threshold: VISIBLE_ENOUGH },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      surrender(stageToken);
    };
  }, [autoplay, src, stageToken]);

  // The chrome only hides over a clip that is RUNNING. Hiding it over a paused
  // clip would leave the reader with a still picture and no way back to the
  // controls short of guessing that the picture is tappable.
  useEffect(() => {
    if (!transport || !chromeShown || !playing) return;
    const timer = window.setTimeout(() => setChromeShown(false), CHROME_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [transport, chromeShown, playing]);

  const reading = surface === "reading";
  // The element's own metadata is authoritative — it is what a seek lands
  // against — and the record's number stands in until it arrives, so the bar
  // does not read "0:00" over a clip the reader can see is longer than that.
  const totalSec = lengthSec ?? (durationMs != null ? durationMs / 1000 : null);
  const progress = totalSec && totalSec > 0 ? elapsedSec / totalSec : 0;

  const seekTo = (seconds: number) => {
    const video = ref.current;
    if (!video) return;
    const end = Number.isFinite(video.duration) ? video.duration : (totalSec ?? 0);
    const to = Math.max(0, Math.min(end, seconds));
    video.currentTime = to;
    // Read back at once rather than waiting for `timeupdate`: the event fires
    // a few times a second, and a knob that lags the thumb dragging it reads
    // as a broken control.
    setElapsedSec(to);
  };

  // A SKIP IS RELATIVE TO THE ELEMENT, never to the rendered clock. Two taps
  // land inside one render, so a second skip computed from state would step
  // from where the first one started rather than from where it arrived.
  const skipBy = (seconds: number) => {
    const video = ref.current;
    if (video) seekTo(video.currentTime + seconds);
  };

  return (
    <span className="relative block size-full">
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
        // A FEED CLIP LOOPS AND A CLIP UNDER THE REAL TRANSPORT STOPS (jakob
        // 2026-09-14, via the design loop). It sharpens the deliberate
        // reel-vs-video split: a clip in a card or a stream is a MOMENT, read
        // with the scroller's grammar, and stopping it would leave a card gone
        // still and dead under a reader still looking at it. A clip the reader
        // opened on purpose — the detail's pinned clip, the viewer — is a
        // PROGRAMME, read with a player's grammar, and a programme that silently
        // restarted would be a player that never admits it finished. The
        // transport then stands at its Play glyph, and pressing it replays.
        loop={!transport}
        preload="metadata"
        aria-label={altText ?? undefined}
        data-testid={testId}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        // The transport's whole state comes off these: what the element is
        // doing IS what the controls report, so a play that the browser
        // refused shows as paused rather than as a lying pause glyph.
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        // A clip that runs out is a clip at rest, and the transport has to say
        // so. The HTML spec fires `pause` before `ended` for a non-looping
        // element, but only "if the media element's paused attribute is false"
        // (html.spec.whatwg.org, "playback has ended"), so the state is taken
        // from the event that is guaranteed rather than from the one that is
        // conditional.
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setElapsedSec(event.currentTarget.currentTime)}
        onDurationChange={(event) => {
          const length = event.currentTarget.duration;
          // A stream whose length the browser does not know answers `Infinity`
          // or `NaN`, and a timeline against an unknown end is a knob that
          // cannot mean anything — the record's own number stands instead.
          if (Number.isFinite(length)) setLengthSec(length);
        }}
        // A TAP ON THE VIDEO REVEALS THE CHROME. It is the player's own
        // gesture rather than the surface's: the surface's tap (back to the
        // stream, or into the viewer) is wired over the frame by the screen
        // that owns it, and reaching the controls must not depend on it.
        onClick={
          transport
            ? () => {
                if (chromeShown && onOpenViewer) onOpenViewer();
                else setChromeShown((shown) => !shown);
              }
            : undefined
        }
        // `object-cover` IS THE RULING, not a taste: a clip keeps its native
        // ratio clamped to tall — 16:9 and 1:1 display true, anything taller
        // than 4:5 centre-crops to it, and letterboxing exists nowhere (the
        // reel round, review 1). Without it the element takes the CSS default
        // `object-fit: fill`, so the moment a caller's reserved box didn't
        // match the clip's own ratio the picture was squeezed to fit it.
        // THE GROUND BEHIND A FITTED FRAME IS THE VIEWER'S OWN BLACK. Every
        // other surface FILLS its box, so the reserved surface only ever shows
        // before the bytes land; the viewer fits, so what sits beside a 16:9
        // clip is ground the reader looks at — and a theme-coloured band there
        // would be a light strip down a black screen.
        className={[
          reading || framed ? "block size-full" : "block w-full",
          fit === "contain" ? "object-contain" : "bg-surface-container-high object-cover",
        ].join(" ")}
      />

      {/* THE LADDER'S SECOND RUNG, and it REPLACES the disc rather than
          joining it: the sound decision moves into the bar, because "a disc
          beside a bar is two pieces of chrome for one clip"
          (`design/components/media/MediaAttachment.jsx:281-294`). */}
      {transport && chromeShown && (
        <VideoTransport
          playing={playing}
          elapsed={formatDuration(Math.floor(elapsedSec) * 1000)}
          duration={formatDuration((totalSec ?? 0) * 1000)}
          progress={progress}
          muted={muted}
          testId={`${testId}-transport`}
          onTogglePlay={() => {
            const video = ref.current;
            if (!video) return;
            if (video.paused) {
              // A press claims the stage the same way arriving in view does:
              // one clip plays at a time however it was started, so pressing
              // play here pauses whatever was running (FE-28).
              claim(stageToken, video);
              video.muted = isMuted();
              // PLAY AT THE END IS REPLAY. `play()` on an ended element seeks
              // to the start itself — "if the playback position is the end of
              // the media resource… seek to the earliest possible position"
              // (html.spec.whatwg.org, the play() algorithm) — but only when
              // the direction of playback is forwards and the element is not
              // looping, so the seek is stated rather than relied on: it is
              // also what puts the rendered clock back to 0:00 in the same
              // frame, instead of a tick later.
              if (video.ended) seekTo(0);
              void video.play().catch(() => {});
            } else {
              video.pause();
            }
            // The press is also touching the chrome, so it stays up: a control
            // that vanishes the moment it is used is one the reader has to
            // re-summon to press twice.
            setChromeShown(true);
          }}
          onToggleMute={() => setMuted(!muted)}
          onSeek={(fraction) => seekTo(fraction * (totalSec ?? 0))}
          onSkip={skipBy}
          onFullscreen={onOpenViewer}
        />
      )}

      {/* THE ONE CONTROL EVERY CARD'S CLIP WEARS — no play/pause, no duration
          pill, at both scales (design/readme.md, "the video conform round").
          It carries the sticky decision every video shares, so pressing it
          here changes the sound for the whole session — which is why it
          reads the shared store rather than the element. */}
      {!transport && (
        <button
          type="button"
          data-testid={`${testId}-sound`}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          aria-pressed={!muted}
          onClick={() => setMuted(!muted)}
          className="cg-state cg-focus absolute bottom-2 left-2 grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-surface-snackbar p-0 text-on-surface-snackbar"
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
            {muted ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
        </button>
      )}
    </span>
  );
}
