import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* PROPOSED — the two rungs of the control ladder above the feed card's sound
   disc (readme §13, the reel round; the anatomy revised in review round 1).

   THE LADDER. A feed card carries sound and nothing else: presence on screen is
   the policy there, and a card is a place you are passing through. Where the
   clip IS the thing — the detail view, the fullscreen viewer — the reader is
   watching deliberately, and deliberate watching wants a way to stop, a way to
   step, and a way to move: `VideoTransport`. In the stream a full transport
   would be chrome over the one thing the reader came for, so it thins to
   `SeekLine`, the same gesture with no glyphs.

   THE ANATOMY IS ANDROID'S VIDEO PLAYER (jakob, review round 1 — "YouTube's
   android player is pretty close to perfect"), because a transport is the one
   place in this product where inventing a layout costs the reader something:

   · The BIG CENTRED PLAY/PAUSE, flanked by skip-back and skip-forward. Centred,
     because the thumb that reaches for it is not aiming at a corner, and it is
     the control the reader wants most often.
   · The BAR ALONG THE BOTTOM, INSET FROM THE EDGE: elapsed · the timeline ·
     total, with the fullscreen toggle at its right end.
   · NOTHING TOUCHES THE BOTTOM EDGE. Android's system gesture zone lives in the
     last strip of the screen, so a control there is not a control — it is a
     swipe that closes the app. This is why the bar is inset and why the stream's
     seek line rides above the bottom bar rather than under it.
   · The way out — the back arrow or the X — sits TOP-LEFT, outside this
     component: it belongs to the surface, not the player.

   UNIFORM FOR EVERY CLIP. The transport does not appear for long videos and
   hide for short ones: a reader who learns a control on one clip must find it
   on the next, and a rule with a threshold in it is a rule nobody can predict.

   THE CHROME AUTO-HIDES, and a tap on the video brings it back. What is drawn
   on the boards is the revealed state, because a board of the hidden state is a
   board of a video.

   No settings gear, no speed menu, no cast: everything else a player usually
   grows is chrome this product has no use for. */

/* The inset that keeps the bar clear of the system gesture zone. */
export const GESTURE_ZONE = 16;

const TIME = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  fontVariantNumeric: "tabular-nums",
  color: "#fff",
  flex: "none",
};

/* Chrome over photography needs its own contrast. Glyphs take a shadow rather
   than a plate each: five plates down a frame is a wall of chrome. */
const OVER_MEDIA = "drop-shadow(0 1px 3px rgba(0,0,0,0.6))";

function TransportButton({ label, glyph, size = 22, box = 32, onClick, style }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        if (onClick) onClick(event);
      }}
      className="cg-state cg-focus"
      style={{
        display: "grid",
        placeItems: "center",
        width: `${box}px`,
        height: `${box}px`,
        flex: "none",
        border: "none",
        background: "transparent",
        borderRadius: "var(--radius-full)",
        color: "#fff",
        padding: 0,
        cursor: "pointer",
        filter: OVER_MEDIA,
        ...style,
      }}
    >
      <Icon name={glyph} size={size} />
    </button>
  );
}

/* THE TIMELINE. A slider, not a progress bar — it reports where the clip is and
   it is how the reader moves it, which is why it carries the knob and the
   slider role rather than a bare filled track. */
export function Timeline({ progress = 0, elapsed, duration, thin = false }) {
  const at = Math.max(0, Math.min(1, progress));
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(at * 100)}
      aria-valuetext={elapsed && duration ? `${elapsed} of ${duration}` : undefined}
      className="cg-focus"
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        height: thin ? "3px" : "16px",
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        touchAction: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "3px",
          borderRadius: "var(--radius-full)",
          background: "rgba(255,255,255,0.32)",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 0,
          width: `${at * 100}%`,
          height: "3px",
          borderRadius: "var(--radius-full)",
          background: "var(--primary)",
        }}
      />
      {!thin && (
        <span
          style={{
            position: "absolute",
            left: `${at * 100}%`,
            width: "12px",
            height: "12px",
            marginLeft: "-6px",
            borderRadius: "var(--radius-full)",
            background: "var(--primary)",
          }}
        />
      )}
    </div>
  );
}

/* The whole player's chrome, laid over the media it controls: absolutely inset,
   so it is bounded by the frame and never by the page. */
export function VideoTransport({
  playing = true,
  elapsed = "0:00",
  duration = "0:00",
  progress = 0,
  muted = true,
  fullscreen = true,
  onTogglePlay,
  onToggleMute,
  onFullscreen,
  onSkip,
  inset = GESTURE_ZONE,
}) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
      {/* The wash: a gradient rather than a bar, so nothing cuts the frame. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "45%",
          background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))",
          pointerEvents: "none",
        }}
      />
      {/* THE CENTRE CLUSTER. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-6)",
        }}
      >
        <TransportButton label="Back ten seconds" glyph="fast_rewind" size={26} box={44} onClick={onSkip} />
        <TransportButton
          label={playing ? "Pause" : "Play"}
          glyph={playing ? "pause" : "play_arrow"}
          size={34}
          box={64}
          onClick={onTogglePlay}
          style={{ background: "rgba(0,0,0,0.35)" }}
        />
        <TransportButton label="Forward ten seconds" glyph="fast_forward" size={26} box={44} onClick={onSkip} />
      </div>
      {/* THE BAR, held clear of the gesture zone. */}
      <div
        style={{
          position: "absolute",
          left: "12px",
          right: "12px",
          bottom: `${inset}px`,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <span style={{ ...TIME, filter: OVER_MEDIA }}>{elapsed}</span>
        <Timeline progress={progress} elapsed={elapsed} duration={duration} />
        <span style={{ ...TIME, opacity: 0.85, filter: OVER_MEDIA }}>{duration}</span>
        {/* The sound decision rides the bar rather than keeping its disc: a disc
            beside a bar is two pieces of chrome for one clip. */}
        <TransportButton
          label={muted ? "Turn sound on" : "Turn sound off"}
          glyph={muted ? "volume_off" : "volume_up"}
          size={20}
          box={28}
          onClick={onToggleMute}
        />
        {fullscreen && (
          <TransportButton label="Full screen" glyph="fullscreen" size={20} box={28} onClick={onFullscreen} />
        )}
      </div>
    </div>
  );
}

/* THE STREAM'S RUNG: a hairline dragged to seek, and the only transport the
   stream has — a play/pause there would answer a question nobody scrolling a
   stream is asking. It sits ABOVE the bottom bar, never on the screen's own
   edge, where Android's gesture zone would swallow it. */
export function SeekLine({ progress = 0, elapsed, duration }) {
  return <Timeline progress={progress} elapsed={elapsed} duration={duration} thin />;
}
