import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { VideoTransport, GESTURE_ZONE } from "./VideoControls.jsx";
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
     paged here exactly as it is in the card, DOTS AND ALL — dots only, no
     arrows (item 21's pager ruling). Arrows would be a second vocabulary for a
     gesture the reader already has, and the count belongs in the accessible
     name rather than on the frame.
   · THE DOT ROW IS WINDOWED (item 67, ruled 2026-09-14). At most seven dots
     are drawn; past that the row slides and its overflowing edge dot shrinks —
     see `ViewerDots` below for why.
   · A VIDEO TAKES THE FULL TRANSPORT (`VideoTransport`) — play/pause and a real
     timeline — and ROTATING THE DEVICE fills the screen with it. Rotation is
     the device's own gesture, so there is no rotate control to draw.
   · NO ACTS. No opinion, no comments, no share: acting on a post happens where
     the post is, and a viewer that grows a toolbar is a viewer nobody trusts to
     close.
   · THE DESCRIPTION IS NOT SHOWN. Alt text is written for the people who cannot
     see the frame, and printing it under the picture turns a description into a
     caption the author never wrote.

   The scrim is the dialog scrim, so the viewer belongs to the same family as
   every other thing that covers the screen in this system. */

/* THE WINDOWED DOT ROW (item 67, ruled 2026-09-14: "n of m dots with max dots,
   just copy how insta does it").

   A ROW THAT GROWS WITH THE SET STOPS BEING A POSITION MARKER. Ten dots at 12px
   of pitch is a ruler, and a reader counting rungs is doing the work the marker
   exists to save. So the row has A CEILING — seven slots, the same bound the
   pattern this copies uses — and past it the row is a WINDOW onto the set
   rather than a picture of it.

   THE WINDOW SLIDES, CENTRED ON WHERE THE READER IS. Its start is the current
   index less half the window, clamped to the set's two ends: the active dot
   travels to the middle and stays there while the row moves under it, and at
   either end the window parks so the last dot of the set can be reached.

   AN EDGE DOT WITH MORE BEYOND IT IS SMALLER. That is the whole of how the row
   admits what it is not showing: a shrunk dot at the edge reads as "the set
   keeps going this way", where a full one reads as "this is the end". One
   smaller size and not a ladder of them — at a 6px dot a third size is noise,
   and with the authoring cap at ten pictures the row never hides more than
   three. THE ACTIVE DOT IS NEVER THE SHRUNK ONE: the clamp above keeps it off
   an overflowing edge, so the dot that says "here" is always full size.

   EVERY SLOT KEEPS ITS PITCH. The dot is centred in a slot the size of a full
   dot, so shrinking one moves nothing beside it — a row that reflowed as the
   reader swiped would be its own kind of noise.

   THE COUNT IS NOT DRAWN. The plain "Picture n of m" stays in the accessible
   name, where it has always been: the frame carries the dots, a listener
   carries the number. */
const DOT_WINDOW = 7;
const DOT_FULL = 6;
const DOT_EDGE = 4;

export function ViewerDots({ count, current }) {
  if (count < 2) return null;
  const window = Math.min(count, DOT_WINDOW);
  const start = Math.max(0, Math.min(current - (window >> 1), count - window));
  const slots = Array.from({ length: window }, (_, offset) => start + offset);
  const moreBefore = start > 0;
  const moreAfter = start + window < count;

  return (
    <div
      aria-label={`Picture ${current + 1} of ${count}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: `${DOT_FULL}px`,
        filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
      }}
    >
      {slots.map((index, offset) => {
        const edge =
          (offset === 0 && moreBefore) || (offset === window - 1 && moreAfter);
        const size = edge ? DOT_EDGE : DOT_FULL;
        return (
          <span
            key={index}
            style={{
              width: `${DOT_FULL}px`,
              height: `${DOT_FULL}px`,
              display: "grid",
              placeItems: "center",
            }}
          >
            <span
              style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: "var(--radius-full)",
                background: index === current ? "#fff" : "rgba(255,255,255,0.42)",
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

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

  /* THE SET IS READ THE WAY THE CARD READS IT: dots, and the swipe (item 21's
     pager ruling — dots only, never arrows and never a "1/n" pill). Arrows here
     would be a second vocabulary for a gesture the reader already has, and the
     count belongs to the accessible name, not the frame. The row itself is
     `ViewerDots`, windowed at seven. */
  const dots = count > 1 && (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: `${GESTURE_ZONE}px`,
        zIndex: 3,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <ViewerDots count={count} current={current} />
    </div>
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
      <div className="cg-viewer-stage" onClick={(event) => event.stopPropagation()} style={{ position: "absolute", inset: 0 }}>
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
      {dots}
      {/* The way out. Top-left, over the frame: the chrome belongs to the
          surface, not to the picture. */}
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
      </div>
    </div>
  );
}
