import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* PROPOSED — design.md §6's "media attachment", with the two rules that were open
   last session now settled by the product (2026-08-26 hand-off).

   DECIDED, and built here:
   · "aspect-ratio-reserved tile with optional alt text; gallery layout for
     multiples. SPACE IS RESERVED BEFORE LOAD SO CONTENT NEVER JUMPS." That is the
     load-bearing rule and the reason this exists ahead of the feature: a layout
     designed without reserved space is a layout that will jump.
   · A POST FITS THE SCREEN. The card — author row, media, text, affordances —
     must sit inside the phone's height minus the top safe area and the bottom
     bar, or the reader never sees a post whole and has to scroll to reach the
     affordances. Media is the only part that can flex, so the cap lands here:
     `--media-max-height`, which budgets for the WORST-CASE chrome rather than the
     average — see tokens/spacing.css. A capped tile is not cropped: the frame is
     fitted inside whatever height is left.
   · The tile sits at the medium (12px) rung inside a card, on
     `surfaceContainerHigh` — a step above the card's own fill, so an unloaded
     tile reads as a reserved region rather than a hole.
   · Alt text is authored, optional, and never invented. A tile with none is
     `aria-hidden`, because a decorative-by-omission image is better than a
     machine-guessed description.
   · PORTRAIT CAP 4:5. Taller media (3:4, 2:3, 9:16) is not shown taller — a 9:16
     tile eats a phone screen whole, which is the opposite of a scrollable feed;
     4:5 is the cap because it is the widely-used default.
   · THE FRAME IS SHOWN WHOLE (2026-08-26). The cap bounds the TILE, not the
     picture: a taller frame is fitted inside it and the reserved surface shows at
     the sides, rather than the frame being cut. Nothing about the author's crop is
     decided by the layout. The bars are plain surfaceContainerHigh — the same
     reserved region the tile already is — and never a blurred enlargement of the
     photo itself, which invents image where there is none and is exactly the
     attention device §1 rules out.
     THE ONE EXCEPTION is a gallery's SECONDARY tiles: those squares are an index
     into the set, not the media itself, so they crop to stay a legible grid. The
     lead tile, and any single attachment, always shows the whole frame.
   · VIDEO AUTOPLAYS, MUTED, and the mute decision is GLOBAL AND STICKY. Unmute
     one video and the next one down is already unmuted; mute it again and they
     all go quiet. Tapping every clip to start it is friction with no upside, and
     a per-video mute state means the reader re-decides the same thing on every
     scroll. It only plays while it is actually on screen (half-visible, via
     IntersectionObserver) — offscreen video is neither calm nor cheap.

   The sound toggle shows the CURRENT state (`volume_up` = sound on) and its
   accessible name says what the tap will DO. Still open: the interaction between
   a gallery and §9's sensitive blur.

   `src`-less tiles render the reserved region with a label saying what belongs
   there. Real photography for mocks now lives in `assets/photos/`. */

const RATIOS = { landscape: "16 / 9", square: "1 / 1", portrait: "4 / 5" };

/* The global mute decision. One value for every video on every surface, so a
   reader decides "sound on" once. Module-level rather than context: a feed and a
   detail view mounted from different trees still share it. */
const muteStore = {
  muted: true,
  listeners: new Set(),
  set(next) {
    if (this.muted === next) return;
    this.muted = next;
    this.listeners.forEach((fn) => fn(next));
  },
};

export function useGlobalMute() {
  const [muted, setLocal] = React.useState(muteStore.muted);
  React.useEffect(() => {
    muteStore.listeners.add(setLocal);
    setLocal(muteStore.muted);
    return () => muteStore.listeners.delete(setLocal);
  }, []);
  return [muted, (next) => muteStore.set(next)];
}

export function MediaAttachment({
  src,
  poster,
  alt,
  ratio = "landscape",
  kind = "image",
  label = "Media",
  radius = "var(--radius-medium)",
  fit = "contain",
  maxHeight = "var(--media-max-height)",
}) {
  const [muted, setMuted] = useGlobalMute();
  const videoRef = React.useRef(null);
  const frameRef = React.useRef(null);

  /* Play only while at least half the tile is on screen. */
  React.useEffect(() => {
    const frame = frameRef.current;
    if (kind !== "video" || !src || !frame || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current;
        if (!video) return;
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.5 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [kind, src]);

  React.useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <div
      ref={frameRef}
      style={{
        position: "relative",
        aspectRatio: RATIOS[ratio] ?? ratio,
        width: "100%",
        maxHeight,
        minHeight: 0,
        overflow: "hidden",
        borderRadius: radius,
        background: "var(--surface-container-high)",
      }}
    >
      {src && kind === "video" ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted={muted}
          autoPlay
          loop
          playsInline
          preload="metadata"
          aria-label={alt}
          style={{ display: "block", width: "100%", height: "100%", objectFit: fit }}
        />
      ) : src ? (
        <img
          src={src}
          alt={alt ?? ""}
          aria-hidden={alt ? undefined : "true"}
          style={{ display: "block", width: "100%", height: "100%", objectFit: fit }}
        />
      ) : (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontSize: "var(--text-label-medium)",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
      )}
      {/* The one control a video carries. No play/pause: it plays when it is on
          screen, which is the whole policy. It keeps a surface behind it because
          it sits on photography, where a bare glyph would disappear — the one
          exception to "no icon buttons with backgrounds". */}
      {kind === "video" && (
        <button
          type="button"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          aria-pressed={!muted}
          onClick={(event) => {
            event.stopPropagation();
            setMuted(!muted);
          }}
          className="cg-state cg-focus"
          style={{
            position: "absolute",
            left: "8px",
            bottom: "8px",
            display: "grid",
            placeItems: "center",
            width: "36px",
            height: "36px",
            border: "none",
            borderRadius: "var(--radius-full)",
            background: "var(--surface-snackbar)",
            color: "var(--on-surface-snackbar)",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <Icon name={muted ? "volume_off" : "volume_up"} size={20} />
        </button>
      )}
    </div>
  );
}

/* One, two, or three-and-more, and nothing cleverer. The first tile leads at the
   post's own ratio; the rest share a row of squares, so the reserved height is a
   function of the count alone and can be computed before anything loads. A
   fourth-and-beyond count shows three and a remainder — a gallery that grows a
   new row per image changes the height of every card below it. */
export function MediaGallery({ items = [], ratio = "landscape", radius }) {
  if (items.length === 0) return null;
  if (items.length === 1) {
    return <MediaAttachment {...items[0]} ratio={items[0].ratio ?? ratio} radius={radius ?? items[0].radius} />;
  }
  const [lead, ...rest] = items;
  const shown = rest.slice(0, 2);
  const remainder = rest.length - shown.length;
  // The CAP IS ON THE WHOLE GALLERY, not each tile: lead and strip together have
  // to leave the rest of the card on screen. Roughly 60/40, because the lead is
  // the media and the strip is only an index into the set.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "var(--media-max-height)", overflow: "hidden" }}>
      <MediaAttachment {...lead} ratio={lead.ratio ?? ratio} radius={radius ?? lead.radius} maxHeight="calc(var(--media-max-height) * 0.6)" />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${shown.length}, 1fr)`, gap: "2px" }}>
        {shown.map((item, index) => (
          <div key={item.src ?? index} style={{ position: "relative" }}>
            {/* Secondary tiles crop: they are an index into the set, not the
                media itself, and a ragged grid of fitted thumbnails reads as a
                mistake. The whole frame is one tap away in the viewer. */}
            <MediaAttachment {...item} ratio="square" fit="cover" radius={radius ?? item.radius} maxHeight="calc(var(--media-max-height) * 0.4)" />
            {remainder > 0 && index === shown.length - 1 && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: radius ?? "var(--radius-medium)",
                  background: "var(--scrim-dialog)",
                  color: "var(--inverse-on-surface)",
                  fontSize: "var(--text-title-medium)",
                }}
              >
                +{remainder}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
