import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { VideoTransport } from "./VideoControls.jsx";
import { useGlobalMute } from "./MediaAttachment.jsx";

/* PROPOSED — the full-media view. Settled 2026-08-26: media in a post is shown
   WHOLE, and tapping it in the detail view opens it "covering as much of the
   screen as possible". Its own surfaces were ruled 2026-09-03 (readme §13, the
   reel round).

   THE RULES THIS ENCODES:
   · IT IS THE WHOLE SURFACE, on BLACK, with nothing behind it. Not a scrim over
     the post: a viewer you can still read a card through is not full screen, and
     the ground has to be black so the frame's own edges are the only edges.
   · The frame is never cut here. `contain`, centred, as large as the surface
     allows — a viewer that crops is not a viewer. This is the surface the feed
     card's 4:5 clamp exists against: whatever a card crops, the viewer restores.
   · THE STAGE IS POSITIONED, NEVER FLEX-SIZED. The media fills an absolutely
     inset box and is fitted inside it, so containment never depends on the
     frame's own proportions. Sizing it with `flex: 1` and a percentage
     `max-height` is what broke this component's first cut: the percentage
     resolved against an indefinite height, a wide frame took its intrinsic size,
     and everything after it — the transport above all — was pushed outside the
     screen entirely.
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
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        [direction < 0 ? "left" : "right"]: "4px",
        zIndex: 3,
        width: "var(--touch-target-min)",
        height: "var(--touch-target-min)",
        display: "grid",
        placeItems: "center",
        border: "none",
        background: "transparent",
        borderRadius: "var(--radius-full)",
        color: "#fff",
        filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <Icon name="arrow_back" style={direction < 0 ? undefined : { transform: "scaleX(-1)" }} />
    </button>
  );

  const media =
    item.kind === "video" ? (
      <video
        src={item.src}
        poster={item.poster}
        autoPlay
        playsInline
        aria-label={item.alt}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
      />
    ) : (
      <img
        src={item.src}
        alt={item.alt ?? ""}
        aria-hidden={item.alt ? undefined : "true"}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
      />
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media"
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* THE STAGE. Absolutely inset, the frame fitted inside it — so what is
          drawn is bounded by the screen whatever shape the frame is. The
          click-stop keeps a tap ON the media from closing what was just opened. */}
      <div onClick={(event) => event.stopPropagation()} style={{ position: "absolute", inset: 0 }}>
        {media}
        {/* The transport is the product's own, not the browser's default set:
            one control vocabulary across the detail view, the stream and here,
            rather than three players that each look like their platform. No
            fullscreen toggle — this IS the fullscreen. */}
        {item.kind === "video" && (
          <VideoTransport
            playing={playing}
            elapsed={elapsed}
            duration={duration}
            progress={progress}
            muted={muted}
            fullscreen={false}
            onToggleMute={() => setMuted(!muted)}
          />
        )}
      </div>
      {count > 1 && arrow(-1)}
      {count > 1 && arrow(1)}
      {/* The way out, and where in a set the reader is. Top-left, over the
          frame: the chrome belongs to the surface, not to the picture. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "8px",
          zIndex: 3,
        }}
      >
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
            color: "#fff",
            filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Icon name="close" />
        </button>
        {count > 1 && (
          <span
            style={{
              fontSize: "var(--text-label-large)",
              color: "#fff",
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
            }}
          >
            {current + 1} of {count}
          </span>
        )}
      </div>
    </div>
  );
}
