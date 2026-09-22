"use client";

// THE CONTROL LADDER'S SECOND RUNG — the transport a clip wears where the clip
// IS the thing the reader came for (design/readme.md, "The control ladder": a
// feed card carries the sound disc alone; "a detail view carries play/pause and
// a real timeline, a tap anywhere on it or a drag along it"; the fullscreen
// viewer carries the same full transport).
//
// THE ANATOMY IS THE PLATFORM PLAYER'S, not ours
// (design/components/media/VideoControls.jsx:15-29): a big centred play/pause
// flanked by the skips, and a bar along the bottom carrying elapsed, the
// timeline, total and the sound. "A transport is the one place in this product
// where inventing a layout costs the reader something."
//
// NOTHING TOUCHES THE BOTTOM EDGE. The board insets the bar by `GESTURE_ZONE`
// because Android's system gesture strip lives there, and the two clients read
// the same ladder — so the web bar carries the same inset rather than a second
// geometry that happens to be safe in a browser.
//
// THE COLOURS ARE LITERALS, deliberately. Chrome that sits ON MEDIA cannot read
// a theme role: it has to stay legible against arbitrary pixels in both themes.
// This mirrors android's `MediaOverlay` token object, and the values are read
// off the board rather than chosen here.
//
// IT IS BUILT SHAREABLE: the fullscreen viewer is the ladder's other
// full-transport surface and consumes this same component. The bar ends in a
// FULLSCREEN TOGGLE (`VideoControls.jsx:231-233`) wherever it is handed one to
// open — which is every full-transport surface but the viewer itself, where
// "this IS the fullscreen".

import { useRef } from "react";

import { Icon, type GlyphName } from "@/lib/ui/icons";

/** The inset that keeps the bar clear of the system gesture zone
 * (`VideoControls.jsx:43` — `export const GESTURE_ZONE = 16`). */
export const GESTURE_ZONE = 16;

/** What a skip is worth, said by the board's own labels
 * (`VideoControls.jsx:196` / `:205` — "Back ten seconds" / "Forward ten
 * seconds"). */
export const SKIP_SECONDS = 10;

/** Chrome over photography needs its own contrast, and glyphs take a shadow
 * rather than a plate each: five plates down a frame is a wall of chrome
 * (`VideoControls.jsx:54-56`). */
const OVER_MEDIA = "drop-shadow(0 1px 3px rgba(0,0,0,0.6))";

const INK = "#fff";
const PLAY_PLATE = "rgba(0,0,0,0.35)";
const TRACK = "rgba(255,255,255,0.32)";
const WASH = "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))";

/**
 * THE TARGET IS 48px EVEN WHERE THE DISC IS DRAWN AT 28.
 *
 * "Touch targets never below 48px" (design/readme.md §4), and this bar's sound
 * and fullscreen discs are drawn at 28 while the skips are drawn at 44 — all
 * three under it. The board's geometry is not the thing to change, the TARGET
 * is, which is exactly what `cg-hit` exists for: a transparent overlay centred
 * on the control reaches `--touch-target-min` on both axes while the ink stays
 * put, and its `min-*: 100%` keeps it from ever shrinking one that is already
 * larger. The same trade `Button`'s small rung and `Chip` already make, and the
 * same one android takes from Material's `minimumInteractiveComponentSize`.
 */
function TransportButton({
  label,
  glyph,
  size = 22,
  box = 32,
  onClick,
  testId,
  plate = false,
}: {
  label: string;
  glyph: GlyphName;
  size?: number;
  box?: number;
  onClick: () => void;
  testId: string;
  plate?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      // The tap belongs to the control, never to the frame under it: the
      // surface wires its own tap on the video (reveal the chrome, and later
      // the viewer), and a press that did both would fire two answers.
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="cg-state cg-focus cg-hit relative grid flex-none cursor-pointer place-items-center rounded-full border-0 p-0"
      style={{
        width: `${box}px`,
        height: `${box}px`,
        color: INK,
        background: plate ? PLAY_PLATE : "transparent",
        filter: OVER_MEDIA,
      }}
    >
      <Icon name={glyph} size={size} />
    </button>
  );
}

/**
 * THE TIMELINE — a slider, not a progress bar.
 *
 * "It reports where the clip is and it is how the reader moves it, which is why
 * it carries the knob and the slider role rather than a bare filled track"
 * (`VideoControls.jsx:89-91`).
 *
 * The interaction is the ARIA slider pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/slider/): arrows step, Home and End
 * jump to the ends, and the accessible value is the position as a percentage
 * with `aria-valuetext` saying it in clock time, which is what a reader
 * actually wants read out. Pointer capture is what makes the drag survive the
 * pointer leaving the track
 * (https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) —
 * without it a drag off the right end stops seeking mid-gesture.
 */
export function Timeline({
  progress = 0,
  elapsed,
  duration,
  thin = false,
  onSeek,
  testId = "video-timeline",
}: {
  progress?: number;
  elapsed?: string;
  duration?: string;
  /** The stream's rung: the same gesture with no glyphs and no knob. */
  thin?: boolean;
  /** Where the reader put it, as a fraction of the clip. */
  onSeek?: (fraction: number) => void;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const at = Math.max(0, Math.min(1, progress));

  const seekTo = (fraction: number) => {
    if (onSeek) onSeek(Math.max(0, Math.min(1, fraction)));
  };

  const seekToPointer = (clientX: number) => {
    const track = ref.current;
    if (!track) return;
    const box = track.getBoundingClientRect();
    if (box.width === 0) return;
    seekTo((clientX - box.left) / box.width);
  };

  const step = (delta: number) => seekTo(at + delta);

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(at * 100)}
      aria-valuetext={elapsed && duration ? `${elapsed} of ${duration}` : undefined}
      data-testid={testId}
      className="cg-focus relative flex min-w-0 flex-1 cursor-pointer items-center"
      style={{ height: thin ? "3px" : "16px", touchAction: "none" }}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        seekToPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        seekToPointer(event.clientX);
      }}
      onKeyDown={(event) => {
        // One percent a press, a tenth on Page — the slider pattern's own
        // "step" and "large step". The clip's length never enters into it, so
        // the same press moves the same share of every clip.
        const moves: Record<string, () => void> = {
          ArrowRight: () => step(0.01),
          ArrowUp: () => step(0.01),
          ArrowLeft: () => step(-0.01),
          ArrowDown: () => step(-0.01),
          PageUp: () => step(0.1),
          PageDown: () => step(-0.1),
          Home: () => seekTo(0),
          End: () => seekTo(1),
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        event.stopPropagation();
        move();
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 rounded-full"
        style={{ height: "3px", background: TRACK }}
      />
      <span
        aria-hidden="true"
        className="absolute left-0 rounded-full"
        style={{ width: `${at * 100}%`, height: "3px", background: "var(--primary)" }}
      />
      {!thin && (
        <span
          aria-hidden="true"
          data-testid={`${testId}-knob`}
          className="absolute rounded-full"
          style={{
            left: `${at * 100}%`,
            width: "12px",
            height: "12px",
            marginLeft: "-6px",
            background: "var(--primary)",
          }}
        />
      )}
    </div>
  );
}

/**
 * The whole player's chrome, laid over the media it controls.
 *
 * Absolutely inset, "so it is bounded by the frame and never by the page"
 * (`VideoControls.jsx:152-153`).
 */
export function VideoTransport({
  playing,
  ended = false,
  elapsed,
  duration,
  progress,
  muted,
  onTogglePlay,
  onToggleMute,
  onSeek,
  onSkip,
  onFullscreen,
  inset = GESTURE_ZONE,
  safeArea = false,
  testId = "video-transport",
}: {
  playing: boolean;
  /**
   * Whether the clip has run out.
   *
   * A clip under this transport STOPS at its end rather than looping, so the
   * stopped state needs a control that says what pressing it does: at the end
   * the play button is a REPLAY (jakob 2026-09-15, hand test) — its own glyph
   * and its own label, not the Play glyph wearing a different name. One
   * picture for "resume where you paused" and "start this again from
   * nothing" would be one picture for two different offers.
   */
  ended?: boolean;
  elapsed: string;
  duration: string;
  progress: number;
  muted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSeek: (fraction: number) => void;
  onSkip: (seconds: number) => void;
  /**
   * The way into the fullscreen viewer (`VideoControls.jsx:231-233`).
   *
   * Drawn only where it is handed one, which is the master's own condition
   * (`{fullscreen && …}`): THE VIEWER DOES NOT DRAW IT, because "no fullscreen
   * toggle — this IS the fullscreen" (`MediaViewer.jsx:153`).
   */
  onFullscreen?: () => void;
  inset?: number;
  /**
   * Whether this transport reaches the BOTTOM OF THE SCREEN.
   *
   * [GESTURE_ZONE] is the board's own allowance and it is measured in CSS
   * pixels from the frame's edge — which is the right number inside a framed
   * clip and the wrong one in a fullscreen layer, where the phone's home
   * indicator sits below it and the app-switcher swipe owns that strip (jakob
   * 2026-09-15, hand test: the timeline was in it). `env(safe-area-inset-*)` is
   * the platform's own answer for how much the browser is keeping
   * (https://developer.mozilla.org/en-US/docs/Web/CSS/env), and the document
   * already opts into it with `viewport-fit: cover`.
   */
  safeArea?: boolean;
  testId?: string;
}) {
  const bottom = safeArea
    ? `calc(${inset}px + env(safe-area-inset-bottom))`
    : `${inset}px`;
  return (
    <div className="absolute inset-0 z-[2]" data-testid={testId}>
      {/* The wash: a gradient rather than a bar, so nothing cuts the frame. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ height: "45%", background: WASH }}
      />
      {/* THE CENTRE CLUSTER. Centred "because the thumb that reaches for it is
          not aiming at a corner, and it is the control the reader wants most
          often" (`VideoControls.jsx:19-21`). */}
      <div
        className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center"
        style={{ gap: "var(--space-6)" }}
      >
        <TransportButton
          label={`Back ${SKIP_SECONDS} seconds`}
          glyph="fast_rewind"
          size={26}
          box={44}
          onClick={() => onSkip(-SKIP_SECONDS)}
          testId={`${testId}-rewind`}
        />
        <TransportButton
          label={playing ? "Pause" : ended ? "Replay" : "Play"}
          glyph={playing ? "pause" : ended ? "replay" : "play_arrow"}
          size={34}
          box={64}
          plate
          onClick={onTogglePlay}
          testId={`${testId}-play`}
        />
        <TransportButton
          label={`Forward ${SKIP_SECONDS} seconds`}
          glyph="fast_forward"
          size={26}
          box={44}
          onClick={() => onSkip(SKIP_SECONDS)}
          testId={`${testId}-forward`}
        />
      </div>
      {/* THE BAR, held clear of the gesture zone. */}
      <div
        className="absolute flex items-center"
        style={{ left: "12px", right: "12px", bottom, gap: "var(--space-2)" }}
      >
        <span
          className="flex-none text-label-small tabular-nums"
          style={{ color: INK, filter: OVER_MEDIA }}
          data-testid={`${testId}-elapsed`}
        >
          {elapsed}
        </span>
        <Timeline
          progress={progress}
          elapsed={elapsed}
          duration={duration}
          onSeek={onSeek}
          testId={`${testId}-timeline`}
        />
        <span
          className="flex-none text-label-small tabular-nums"
          style={{ color: INK, opacity: 0.85, filter: OVER_MEDIA }}
          data-testid={`${testId}-duration`}
        >
          {duration}
        </span>
        {/* THE SOUND DECISION RIDES THE BAR rather than keeping its disc: "a
            disc beside a bar is two pieces of chrome for one clip"
            (`VideoControls.jsx:222-223`). */}
        <TransportButton
          label={muted ? "Turn sound on" : "Turn sound off"}
          glyph={muted ? "volume_off" : "volume_up"}
          size={20}
          box={28}
          onClick={onToggleMute}
          testId={`${testId}-sound`}
        />
        {/* THE BAR ENDS IN THE WAY INTO THE VIEWER (`VideoControls.jsx:231`).
            It is the transport's own route there; the clip's surface tap is
            the other (graph.json, `PostDetailVideo` via 19 and via 3). */}
        {onFullscreen && (
          <TransportButton
            label="Full screen"
            glyph="fullscreen"
            size={20}
            box={28}
            onClick={onFullscreen}
            testId={`${testId}-fullscreen`}
          />
        )}
      </div>
    </div>
  );
}
