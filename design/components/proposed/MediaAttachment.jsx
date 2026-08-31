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
   · THE RATIO VOCABULARY IS THE CROP RULING'S (readme §13, compose): tall 4:5,
     square 1:1, wide 1.91:1 — one shape for the whole post, chosen at the crop
     step. `tall` is also the CAP: uncropped media (a comment's pictures never
     crop — jakob 2026-08-31) is not shown taller than 4:5; a 9:16 tile eats a
     phone screen whole, which is the opposite of a scrollable feed.
   · THE FRAME IS SHOWN WHOLE (2026-08-26; without exception since 2026-08-31).
     The cap bounds the TILE, not the picture: a taller frame is fitted inside it
     and the reserved surface shows at the sides, rather than the frame being cut.
     Nothing about the author's crop is decided by the layout. The bars are plain
     surfaceContainerHigh — the same reserved region the tile already is — and
     never a blurred enlargement of the photo itself, which invents image where
     there is none and is exactly the attention device §1 rules out.
   · VIDEO AUTOPLAYS, MUTED, and the mute decision is GLOBAL AND STICKY. Unmute
     one video and the next one down is already unmuted; mute it again and they
     all go quiet. Tapping every clip to start it is friction with no upside, and
     a per-video mute state means the reader re-decides the same thing on every
     scroll. It only plays while it is actually on screen (half-visible, via
     IntersectionObserver) — offscreen video is neither calm nor cheap.

   The sound toggle shows the CURRENT state (`volume_up` = sound on) and its
   accessible name says what the tap will DO. A sensitive post veils the WHOLE
   gallery, never per-picture (jakob 2026-08-31) — the veil wraps this component
   where the card renders it.

   `src`-less tiles render the reserved region with a label saying what belongs
   there. Real photography for mocks now lives in `assets/photos/`. */

const RATIOS = { tall: "4 / 5", square: "1 / 1", wide: "1.91 / 1" };

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
  ratio = "wide",
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

/* THE GALLERY IS A PAGER (jakob 2026-08-31). Every picture in a post shares the
   post's one crop shape, so the honest layout is one frame at that shape,
   swiped: each picture is shown WHOLE, exactly as its author shaped it, and the
   card's height is one frame's height regardless of count. Dots below carry the
   position — dots only, no "1/n" count pill (ruled against). The earlier
   lead-tile-plus-square-strip layout is rejected: its secondary squares
   re-cropped frames the author had deliberately shaped, half-undoing the
   one-crop ruling. The cap is authoring-side — at most TEN pictures, or ONE
   video (with its cover) — the gallery renders what it is given.

   Every frame renders at the ONE frame ratio: the explicit `ratio` prop, else
   the first item's, so uncropped sets (a comment's pictures) pass a fixed frame
   (square) and fit each whole frame inside it — a pager whose height changed
   per swipe would bounce the card under the reader's thumb. */
export function MediaGallery({ items = [], ratio, radius, maxHeight }) {
  const [page, setPage] = React.useState(0);
  const stripRef = React.useRef(null);
  if (items.length === 0) return null;
  if (items.length === 1) {
    return (
      <MediaAttachment
        {...items[0]}
        ratio={items[0].ratio ?? ratio ?? "wide"}
        radius={radius ?? items[0].radius}
        maxHeight={maxHeight ?? items[0].maxHeight}
      />
    );
  }
  const frameRatio = ratio ?? items[0].ratio ?? "wide";
  const onScroll = () => {
    const strip = stripRef.current;
    if (!strip || strip.clientWidth === 0) return;
    const next = Math.round(strip.scrollLeft / strip.clientWidth);
    if (next !== page) setPage(next);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        ref={stripRef}
        onScroll={onScroll}
        style={{
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
        }}
      >
        {items.map((item, index) => (
          <div key={item.src ?? index} style={{ flex: "none", width: "100%", scrollSnapAlign: "start" }}>
            <MediaAttachment {...item} ratio={frameRatio} radius={radius ?? item.radius} maxHeight={maxHeight ?? item.maxHeight} />
          </div>
        ))}
      </div>
      {/* The dots are a readout, not ten targets — the gesture is the swipe. */}
      <div
        aria-label={`Picture ${page + 1} of ${items.length}`}
        style={{ display: "flex", justifyContent: "center", gap: "6px", padding: "8px 0 0" }}
      >
        {items.map((item, index) => (
          <span
            key={item.src ?? index}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "var(--radius-full)",
              background: index === page ? "var(--primary)" : "var(--border-hairline)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
