import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { VideoTransport } from "./VideoControls.jsx";
import { useGlobalMute } from "./MediaAttachment.jsx";

/* PROPOSED — the full-media view. Settled 2026-08-26: media in a post is shown
   WHOLE, and tapping it in the detail view opens it "covering as much of the
   screen as possible". Its own surfaces were ruled 2026-09-03 (readme §13, the
   reel round).

   THE RULES THIS ENCODES:
   · The frame is never cut here. `contain`, centred, as large as the viewport
     allows — a viewer that crops is not a viewer. This is the surface the feed
     card's 4:5 clamp exists against: whatever a card crops, the viewer restores.
   · It is a place you back out of: an X, a swipe DOWN, Escape, and the backdrop
     all close it, and it never changes the underlying route. The X rather than
     a back arrow, because the reader is dismissing a layer, not walking a step
     of a journey — and the swipe is the gesture every full-screen media layer
     is dismissed with.
   · A PICTURE PINCH-ZOOMS, and the gallery's swipe carries over: the set is
     paged here exactly as it is in the card.
   · A VIDEO TAKES THE FULL TRANSPORT (`VideoTransport`) — play/pause and a real
     timeline — and ROTATING THE DEVICE fills the screen with it. Rotation is
     the device's own gesture, so there is no rotate control to draw.
   · NO ACTS. No stance, no comments, no share: acting on a post happens where
     the post is, and a viewer that grows a toolbar is a viewer nobody trusts to
     close.
   · THE DESCRIPTION IS NOT SHOWN. Alt text is written for the people who cannot
     see the frame, and printing it under the picture turns a description into a
     caption the author never wrote.

   The scrim is the dialog scrim, so the viewer belongs to the same family as
   every other thing that covers the screen in this system. */

export function MediaViewer({
  items = [],
  index = 0,
  onClose,
  onIndexChange,
  playing = true,
  elapsed = "0:00",
  duration = "0:00",
  progress = 0,
}) {
  const [current, setCurrent] = React.useState(index);
  const [muted, setMuted] = useGlobalMute();
  const count = items.length;
  const item = items[Math.min(current, Math.max(count - 1, 0))];

  const move = React.useCallback(
    (next) => {
      const wrapped = (next + count) % count;
      setCurrent(wrapped);
      if (onIndexChange) onIndexChange(wrapped);
    },
    [count, onIndexChange],
  );

  React.useEffect(() => setCurrent(index), [index]);

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose && onClose();
      if (count > 1 && event.key === "ArrowRight") move(current + 1);
      if (count > 1 && event.key === "ArrowLeft") move(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, current, move, onClose]);

  if (!item) return null;

  const arrow = (direction) => (
    <button
      type="button"
      aria-label={direction < 0 ? "Previous" : "Next"}
      onClick={(event) => {
        event.stopPropagation();
        move(current + direction);
      }}
      className="cg-state cg-focus"
      style={{
        width: "var(--touch-target-min)",
        height: "var(--touch-target-min)",
        display: "grid",
        placeItems: "center",
        border: "none",
        background: "transparent",
        borderRadius: "var(--radius-full)",
        color: "var(--inverse-on-surface)",
        cursor: "pointer",
        padding: 0,
        flex: "none",
      }}
    >
      <Icon name="arrow_back" style={direction < 0 ? undefined : { transform: "scaleX(-1)" }} />
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "var(--scrim-dialog)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "8px", flex: "none" }}>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="cg-state cg-focus"
          style={{
            width: "var(--touch-target-min)",
            height: "var(--touch-target-min)",
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            borderRadius: "var(--radius-full)",
            color: "var(--inverse-on-surface)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Icon name="close" />
        </button>
        {count > 1 && (
          <span style={{ fontSize: "var(--text-label-large)", color: "var(--inverse-on-surface)" }}>
            {current + 1} of {count}
          </span>
        )}
      </div>
      {/* The frame, whole. The click-stop keeps a tap ON the media from closing
          the thing the reader just opened. */}
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: "var(--space-1)", padding: "0 4px 16px" }}
      >
        {count > 1 && arrow(-1)}
        {item.kind === "video" ? (
          /* The transport is the product's own, not the browser's default set:
             one control vocabulary across the detail view, the stream and here,
             rather than three players that each look like their platform. */
          <div style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", alignItems: "center" }}>
            <video
              src={item.src}
              poster={item.poster}
              autoPlay
              playsInline
              aria-label={item.alt}
              style={{ flex: 1, minWidth: 0, maxHeight: "100%", objectFit: "contain" }}
            />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
              <VideoTransport
                playing={playing}
                elapsed={elapsed}
                duration={duration}
                progress={progress}
                muted={muted}
                onToggleMute={() => setMuted(!muted)}
              />
            </div>
          </div>
        ) : (
          <img
            src={item.src}
            alt={item.alt ?? ""}
            aria-hidden={item.alt ? undefined : "true"}
            style={{ flex: 1, minWidth: 0, maxHeight: "100%", objectFit: "contain" }}
          />
        )}
        {count > 1 && arrow(1)}
      </div>
    </div>
  );
}
