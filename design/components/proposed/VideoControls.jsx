import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* PROPOSED — the two rungs of the control ladder above the feed card's sound
   disc (readme §13, the reel round, jakob 2026-09-03).

   THE LADDER. A feed card carries sound and nothing else: presence on screen is
   the policy there, and a card is a place you are passing through. Where the
   clip IS the thing — the detail view, the fullscreen viewer — the reader is
   watching deliberately, and deliberate watching wants a way to stop and a way
   to move: `VideoTransport`, play/pause plus a real timeline that takes a tap
   anywhere on it or a drag along it. In the stream a full transport would be
   chrome over the one thing the reader came for, so it thins to `SeekLine` at
   the screen's bottom edge — the same gesture, no glyphs.

   UNIFORM FOR EVERY CLIP. The transport does not appear for long videos and
   hide for short ones: a reader who learns a control on one clip must find it
   on the next, and a rule with a threshold in it is a rule nobody can predict.

   THE CHROME AUTO-HIDES, and a tap on the video brings it back. What is drawn
   on the boards is the revealed state, because a board of the hidden state is a
   board of a video.

   No fullscreen button, no settings gear, no speed menu: the viewer is reached
   by tapping the clip, and everything else a player usually grows is chrome the
   product has no use for. */

const BAR = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  padding: "10px 12px",
  /* The gradient, not a bar: chrome over photography needs its own contrast, and
     a hard-edged strip would cut the frame in two. */
  background: "linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))",
  color: "#fff",
};

const TIME = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  fontVariantNumeric: "tabular-nums",
  flex: "none",
};

function TransportButton({ label, glyph, onClick }) {
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
        width: "32px",
        height: "32px",
        flex: "none",
        border: "none",
        background: "transparent",
        borderRadius: "var(--radius-full)",
        color: "inherit",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <Icon name={glyph} size={22} />
    </button>
  );
}

/* THE TIMELINE. A slider, not a progress bar — it reports where the clip is and
   it is how the reader moves it, which is why it carries the knob and the
   slider role rather than a bare filled track. */
function Timeline({ progress = 0, elapsed, duration, thin = false }) {
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
          height: thin ? "3px" : "4px",
          borderRadius: "var(--radius-full)",
          background: thin ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.35)",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 0,
          width: `${at * 100}%`,
          height: thin ? "3px" : "4px",
          borderRadius: "var(--radius-full)",
          background: "#fff",
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
            background: "#fff",
          }}
        />
      )}
    </div>
  );
}

export function VideoTransport({
  playing = true,
  elapsed = "0:00",
  duration = "0:00",
  progress = 0,
  muted = true,
  onTogglePlay,
  onToggleMute,
}) {
  return (
    <div style={BAR}>
      <TransportButton
        label={playing ? "Pause" : "Play"}
        glyph={playing ? "pause" : "play_arrow"}
        onClick={onTogglePlay}
      />
      <span style={TIME}>{elapsed}</span>
      <Timeline progress={progress} elapsed={elapsed} duration={duration} />
      <span style={{ ...TIME, opacity: 0.8 }}>{duration}</span>
      {/* The sound control rides the bar rather than keeping its disc: a disc
          beside a bar is two pieces of chrome for one clip. The decision it
          carries is still the global sticky one. */}
      <TransportButton
        label={muted ? "Turn sound on" : "Turn sound off"}
        glyph={muted ? "volume_off" : "volume_up"}
        onClick={onToggleMute}
      />
    </div>
  );
}

/* THE STREAM'S RUNG: a hairline at the very bottom edge of the screen, dragged
   to seek. It says where the clip is without spending any of the frame, and it
   is the only transport the stream has — a play/pause there would answer a
   question nobody scrolling a stream is asking. */
export function SeekLine({ progress = 0, elapsed, duration }) {
  return (
    <div style={{ padding: "0 0 0 0" }}>
      <Timeline progress={progress} elapsed={elapsed} duration={duration} thin />
    </div>
  );
}
