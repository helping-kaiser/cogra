// The authoring-side picture tile (design/components/compose/MediaThumb).
//
// ONE THUMBNAIL ANATOMY for every composer surface — the pick tray, the details
// row, the Show all sheet, the reply composer, the comment edit — so the states
// a picture can be in are drawn once and read the same everywhere. The states
// ARE the upload story:
//
//  · `cover` — the "Cover" badge, bottom-left. The first picture is the cover
//    and the badge travels with a reorder; there is no separate cover control.
//  · `progress` — the ring on a scrim. Upload starts AFTER the crop, because
//    the crop happens on the device and only the cropped export is ever
//    uploaded (the original frame can hold what the author never meant to
//    share). A comment's crop-less pictures upload at pick.
//  · `failed` — the picture dims and wears the error badge. The words and the
//    Retry · Remove ways out live beside the row (`UploadErrorLine`), never
//    crammed into 48px.
//
// The source is a device-local object URL, so this is a plain `<img>`: the
// optimizer cannot fetch a `blob:` and `next/image` is for what the server
// serves (web.md §Media).
//
// A TILE SHOWS THE FRAMING, NOT THE SOURCE (jakob, round 6: the previews
// afterwards "should display the cropped version so that people dont think it
// has reset"). Hand it the picture's `crop` and it draws the section the author
// framed; hand it none — a comment's crop-less pictures, a pick nobody has
// framed yet — and it cover-fits the whole picture as it always did.

import { cropPreviewStyle } from "../media/crop-preview";
import type { Crop } from "../media/crop";
import { formatDuration } from "../media/video";

const REMOVE_GLYPH =
  "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z";

/**
 * The duration pill's own floor (jakob's ruling, 2026-09-22:
 * design/readme.md §13 — "`MediaThumb` draws the pill on an authoring
 * tile of 80px or more, where an author is identifying a file among
 * files"). `PickedRow`'s 48px default summary tile drew the pill at
 * that size until this ruling, which is what jakob's hand test caught.
 */
const DURATION_BADGE_MIN_TILE = 80;

// THE RING NEVER INVENTS A NUMBER. The upload model reports a state, not a
// fraction, so an upload in flight draws the ring as a turning arc rather than a
// made-up percentage — a determinate ring at a guessed value would be a lie
// told in the one place the author is watching. A measured fraction, when one
// exists, fills the arc instead.
function Ring({ progress, size = 26 }: { progress: number | "indeterminate"; size?: number }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const arc = progress === "indeterminate" ? 0.25 : Math.max(0.02, Math.min(1, progress));
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      aria-hidden="true"
      className={progress === "indeterminate" ? "motion-safe:animate-spin" : undefined}
    >
      <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${arc * c} ${c}`}
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

export function MediaThumb({
  src,
  altText,
  size = 48,
  width,
  height,
  fit = "cover",
  crop,
  radius = "var(--radius-small)",
  cover = false,
  progress,
  failed = false,
  durationMs,
  coverSrc,
  onRemove,
  removeLabel = "Remove this picture",
  testId,
}: {
  src?: string | null;
  altText?: string | null;
  size?: number;
  /**
   * The clip's length, which turns this into the composer's video tile: a play
   * disc and the duration over the poster frame.
   *
   * AUTHORING-SIDE ONLY (design/backlog.md item 31, round 2). A reading surface
   * shows neither — a comment's video in the thread wears one control, the
   * sound, and no duration pill at all. Here the author is choosing a clip and
   * its length is part of what they are choosing.
   *
   * The pill itself only draws once the tile clears `DURATION_BADGE_MIN_TILE`
   * (80px) — below that floor it would outweigh the tile it sits on
   * (jakob's ruling, 2026-09-22: design/readme.md §13).
   */
  durationMs?: number | null;
  /** The framing to show. Omitted where a picture has none. */
  crop?: Crop | null;
  // An uncropped tile (a reply's pictures) states both and fits the whole frame
  // inside them.
  width?: number;
  height?: number;
  fit?: "cover" | "contain";
  radius?: string;
  cover?: boolean;
  progress?: number | "indeterminate";
  failed?: boolean;
  /**
   * A clip's chosen cover, drawn as the frame itself: an inset in the same
   * bottom-left corner `cover`'s badge owns, a third of the tile's short
   * side (28px floor) behind a hairline ring. A tile is a picture's or a
   * clip's, so this and `cover` are never both set
   * (design/components/compose/MediaThumb.jsx:93,192-217).
   */
  coverSrc?: string | null;
  onRemove?: () => void;
  removeLabel?: string;
  testId?: string;
}) {
  const w = width ?? size;
  const h = height ?? size;
  const alt = altText ?? "";
  const edge = Math.min(w, h);
  const coverMark = Math.max(28, Math.round(edge / 3));
  // The duration pill's own floor (jakob's ruling, 2026-09-22:
  // design/readme.md §13 — "`MediaThumb` draws the pill on an authoring
  // tile of 80px or more, where an author is identifying a file among
  // files"). Under it the pill reads as the tile's whole face rather than
  // a corner mark — `PickedRow`'s 48px default summary tile drew it at
  // that size until this ruling, which is what jakob's hand test caught.
  const durationFits = edge >= DURATION_BADGE_MIN_TILE;
  // The play disc's own math (design/components/compose/MediaThumb.jsx:86):
  // 26% of the tile's short edge, clamped to [20, 56]px. Unlike the
  // duration pill's separate 80px floor, the disc has no floor of its
  // own — this clamp IS its floor. The glyph inside is 57% of the disc
  // (MediaThumb.jsx:151).
  const isVideo = typeof durationMs === "number";
  const discSize = Math.max(20, Math.min(56, Math.round(edge * 0.26)));
  const glyphSize = Math.round(discSize * 0.57);
  // The disc rides a scrim over a frame. With no frame the tile IS the
  // absence, and a play control drawn on nothing reads as chrome — the
  // duration stays, because the clip's length is known either way
  // (MediaThumb.jsx:87-90). It also never rides over the upload ring:
  // a control drawn on an in-flight upload would promise a play that
  // is not there yet.
  const playable = isVideo && Boolean(src) && !failed && progress === undefined;
  // A framing wins over `fit`: it already says exactly which section shows and
  // how big it is, so there is nothing left for a fit rule to decide.
  const framing = cropPreviewStyle(crop, { width: w, height: h });
  return (
    <span
      data-testid={testId}
      style={{ width: `${w}px`, height: `${h}px`, borderRadius: radius }}
      className="relative flex flex-none items-center justify-center overflow-hidden bg-surface-container-high"
    >
      {src ? (
        // A blob: URL for bytes that have not left the device, so there is
        // nothing for the optimizer to fetch (web.md §Media).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          aria-hidden={alt === "" ? "true" : undefined}
          data-testid={testId ? `${testId}-image` : undefined}
          data-framed={framing === null ? undefined : "true"}
          style={{ opacity: failed ? 0.5 : 1, ...framing }}
          className={
            framing !== null
              ? "block"
              : fit === "contain"
                ? "block max-h-full max-w-full"
                : "block size-full object-cover"
          }
        />
      ) : null}
      {cover ? (
        <span className="absolute bottom-[3px] left-[3px] rounded-full bg-scrim/55 px-[5px] text-label-small text-white">
          Cover
        </span>
      ) : null}
      {coverSrc ? (
        <span
          data-testid={testId ? `${testId}-cover-mark` : undefined}
          style={{ width: `${coverMark}px`, height: `${coverMark}px` }}
          className="absolute bottom-[3px] left-[3px] block overflow-hidden rounded-small border border-outline-variant box-border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverSrc} alt="Cover" className="block size-full object-cover" />
        </span>
      ) : null}
      {/* The composer's video anatomy: a play disc over the poster and the
          clip's length in the corner. Neither is a control — the tile is a
          thumbnail, and the disc says "this one moves" rather than offering to
          play it here. */}
      {playable ? (
        <span
          aria-hidden="true"
          data-testid={testId ? `${testId}-play` : undefined}
          style={{ width: `${discSize}px`, height: `${discSize}px` }}
          className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-scrim/55 text-white"
        >
          <svg viewBox="0 0 24 24" width={glyphSize} height={glyphSize} fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      ) : null}
      {isVideo && !failed && durationFits ? (
        <span
          data-testid={testId ? `${testId}-duration` : undefined}
          className="absolute bottom-[6px] right-[6px] rounded-extra-small bg-scrim/55 px-[5px] text-label-small text-white"
        >
          {formatDuration(durationMs as number)}
        </span>
      ) : null}
      {progress !== undefined && !failed ? (
        <span
          aria-label={
            progress === "indeterminate" ? "Uploading" : `Uploading, ${Math.round(progress * 100)}%`
          }
          data-testid={testId ? `${testId}-progress` : undefined}
          className="absolute inset-0 grid place-items-center bg-scrim/35"
        >
          <Ring progress={progress} />
        </span>
      ) : null}
      {failed ? (
        <span
          aria-label="Didn't upload"
          data-testid={testId ? `${testId}-failed` : undefined}
          className="absolute right-[3px] top-[3px] grid size-[18px] place-items-center rounded-full bg-error text-label-small text-on-error"
        >
          !
        </span>
      ) : null}
      {/* A failed tile trades its X for the badge: the ways out of a failure are
          words beside the row, not a second meaning for the same corner. */}
      {onRemove && !failed ? (
        <button
          type="button"
          aria-label={removeLabel}
          data-testid={testId ? `${testId}-remove` : undefined}
          onClick={onRemove}
          className="cg-focus absolute right-[3px] top-[3px] flex size-4 items-center justify-center rounded-full bg-scrim/55 text-white"
        >
          <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor" aria-hidden="true">
            <path d={REMOVE_GLYPH} />
          </svg>
        </button>
      ) : null}
    </span>
  );
}
