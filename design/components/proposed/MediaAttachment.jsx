import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { VideoTransport } from "./VideoControls.jsx";

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
   · NOTHING IS LETTERBOXED (jakob 2026-09-03). A tile is filled, never fitted:
     an uncropped picture — a comment's, which never crops on the way up —
     DISPLAY-CROPS to the frame it is given, centred, exactly as a clip does.
     Bars beside a picture spend a card's scarcest resource on nothing, and the
     whole frame is one tap away in the viewer, which is the surface that exists
     to lose nothing. The crop is display-only: the bytes stored are still the
     author's own, uncropped.
   · VIDEO AUTOPLAYS, MUTED, and the mute decision is GLOBAL AND STICKY. Unmute
     one video and the next one down is already unmuted; mute it again and they
     all go quiet. Tapping every clip to start it is friction with no upside, and
     a per-video mute state means the reader re-decides the same thing on every
     scroll. It only plays while it is actually on screen (half-visible, via
     IntersectionObserver) — offscreen video is neither calm nor cheap.
   · A CLIP KEEPS ITS OWN SHAPE, CLAMPED TO TALL (readme §13, the reel round).
     A clip's ratio is not chosen by an author the way a picture's crop is, so
     the crop vocabulary does not govern it: 16:9 and 1:1 clips display true, and
     anything taller than 4:5 CENTRE-CROPS to 4:5 in a card. Nothing here is ever
     letterboxed — a clip fills the frame it is given, and the full 9:16 frame
     lives on the surfaces built for it (the stream, the fullscreen viewer).
   · THE CONTROL LADDER (readme §13, the reel round). What a clip carries depends
     on the surface, and `controls` says which rung this tile is on: `"sound"` —
     a feed card, the sound disc and nothing else; `"transport"` — a detail view,
     play/pause and a real timeline; `"play"` — the one card that draws play,
     because the device suppressed autoplay and nothing is going to start; and
     `"none"` where the surface draws its own.
   · THE COVER IS THE CLIP'S FACE WHEREVER THE CLIP ISN'T RUNNING (`resting`):
     first paint before autoplay, and every context where autoplay is suppressed
     — reduced motion, data saver. It never returns once playback has started.

   The sound toggle shows the CURRENT state (`volume_up` = sound on) and its
   accessible name says what the tap will DO. A sensitive post veils the WHOLE
   gallery, never per-picture (jakob 2026-08-31) — the veil wraps this component
   where the card renders it.

   `src`-less tiles render the reserved region with a label saying what belongs
   there. Real photography for mocks now lives in `assets/photos/`. */

/* `portrait` and `landscape` are a CLIP's native shapes, not crop choices — the
   crop vocabulary (tall · square · wide) still governs every picture. */
const RATIOS = { tall: "4 / 5", square: "1 / 1", wide: "1.91 / 1", portrait: "9 / 16", landscape: "16 / 9" };

const TALL = 4 / 5;
const asNumber = (ratio) => {
  const [w, h] = String(RATIOS[ratio] ?? ratio).split("/").map((n) => Number(n.trim()));
  return h ? w / h : null;
};

/* The shape a clip stands at inside a card: its own, unless it is taller than
   4:5, which centre-crops. Exported because the cover crops identically — it is
   the face of the same clip, and a face that disagreed with it would be a lie. */
export function clipFrame(ratio) {
  const value = asNumber(ratio);
  return value !== null && value < TALL ? "tall" : ratio;
}

/* A control that has to survive whatever photograph is under it: the snackbar
   surface behind the glyph, at the tile's lower-left corner. Every disc a media
   surface draws is this one — sound, play, and the stream's way back — so they
   sit at one size and one weight wherever the reader meets them. */
export function MediaDisc({ label, glyph, onClick, pressed, corner = "bottom-left" }) {
  const [vertical, horizontal] = corner.split("-");
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={(event) => {
        event.stopPropagation();
        if (onClick) onClick(event);
      }}
      className="cg-state cg-focus"
      style={{
        position: "absolute",
        [vertical]: "8px",
        [horizontal]: "8px",
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
        zIndex: 2,
      }}
    >
      <Icon name={glyph} size={20} />
    </button>
  );
}

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
  fit = "cover",
  maxHeight = "var(--media-max-height)",
  controls = "sound",
  resting = false,
  playing = true,
  elapsed = "0:00",
  duration = "0:00",
  progress = 0,
}) {
  const [muted, setMuted] = useGlobalMute();
  const videoRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const video = kind === "video";
  // A clip fills the frame it is given; only a picture may be fitted inside one.
  const frameRatio = video ? clipFrame(ratio) : ratio;
  const objectFit = video ? "cover" : fit;

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
        aspectRatio: RATIOS[frameRatio] ?? frameRatio,
        width: "100%",
        maxHeight,
        minHeight: 0,
        overflow: "hidden",
        borderRadius: radius,
        background: "var(--surface-container-high)",
      }}
    >
      {src && video && !resting ? (
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
          style={{ display: "block", width: "100%", height: "100%", objectFit: objectFit }}
        />
      ) : src || poster ? (
        <img
          src={video ? poster ?? src : src}
          alt={alt ?? ""}
          aria-hidden={alt ? undefined : "true"}
          style={{ display: "block", width: "100%", height: "100%", objectFit: objectFit }}
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
      {/* THE LADDER'S FIRST RUNG. In a card a clip carries the sound disc and
          nothing else: it plays when it is on screen, which is the whole policy.
          The disc keeps a surface behind it because it sits on photography,
          where a bare glyph would disappear — the one exception to "no icon
          buttons with backgrounds". */}
      {video && controls === "sound" && (
        <MediaDisc
          label={muted ? "Turn sound on" : "Turn sound off"}
          pressed={!muted}
          glyph={muted ? "volume_off" : "volume_up"}
          onClick={() => setMuted(!muted)}
        />
      )}
      {/* THE ONE PLACE PLAY IS DRAWN IN A CARD. The device asked for no motion —
          reduced motion, data saver — so nothing is going to start on its own,
          and a cover with no way to play it is a picture pretending to be a
          clip. It takes the sound disc's place rather than joining it: one
          control, the one that matters here. */}
      {video && controls === "play" && (
        <MediaDisc label="Play this video" glyph="play_arrow" onClick={() => {}} />
      )}
      {/* THE SECOND RUNG. On a reading surface built around the clip, the reader
          is watching deliberately, so the transport is real — and the sound
          control moves into it, because a disc beside a bar would be two pieces
          of chrome for one clip. */}
      {video && controls === "transport" && (
        <VideoTransport
          playing={playing}
          elapsed={elapsed}
          duration={duration}
          progress={progress}
          muted={muted}
          onToggleMute={() => setMuted(!muted)}
        />
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
