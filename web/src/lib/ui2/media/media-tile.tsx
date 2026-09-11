// The media tile — one attachment, with its space reserved before it loads.
//
// THAT RESERVATION IS THE WHOLE POINT of the component existing ahead of the
// feature (design.md §6: "space is reserved before load so content never
// jumps"). A layout designed without it is a layout that will jump, and it
// jumps worst on the slow connection where it matters most.
//
// How it is done, and why this way: the wrapper carries `position: relative`
// and a CSS `aspect-ratio`, and the image inside takes next/image's `fill`.
// The Next docs require exactly that pairing — "the parent element must assign
// position: relative | fixed | absolute" — and `sizes` is documented as
// belonging with `fill`, because without it the browser assumes the image is
// as wide as the viewport and downloads a needlessly large file.
// (node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md,
// Next 16.3.x — the version this app pins.)
//
// The tile sits on `surfaceContainerHigh`, a step above the card's own fill, so
// an unloaded tile reads as a RESERVED REGION rather than a hole.

import Image from "next/image";

import { cssRatio, fitFor, tileRatio } from "./aspect";
import { VideoPlayer, type PlayerSurface } from "./video-player";

/** Whether the asset is the moving kind, read off the contract's own field. */
export function isVideoAsset(mimeType?: string | null): boolean {
  return typeof mimeType === "string" && mimeType.startsWith("video/");
}

export type MediaTileProps = {
  src?: string | null;
  /**
   * What the asset IS.
   *
   * Optional HERE and required on `GalleryItem`, which is the deliberate
   * split: a gallery entry is always a real attachment, and the contract
   * types `MediaAttachment.mimeType` as `String!`, so an omitted
   * selection has to be a compile error there. This component also draws
   * the ASSET-LESS reserved region — a labelled frame with no `src` at
   * all — and demanding a type for a file that does not exist would be
   * demanding a fabrication.
   */
  mimeType?: string | null;
  /**
   * The video's face. Null where the asset names none — and null where the
   * cover was REDACTED, because a removed still is not a still to show: the
   * tile's own reserved surface stands in, and the video below it is untouched.
   */
  poster?: string | null;
  durationMs?: number | null;
  /** A feed pauses what scrolls away; a lightbox plays what the reader opened. */
  autoplay?: boolean;
  /** `reading` gives a comment's clip the sound control and nothing else. */
  surface?: PlayerSurface;
  // Authored, optional, and never invented. A tile with none is decorative:
  // `alt=""` is the documented correct value for an image that adds no
  // information, and it is a better answer than a machine-guessed description.
  altText?: string | null;
  // The ratio the server probed off the bytes. Null before the probe lands.
  sourceRatio?: number | null;
  // What belongs here, shown while there is no source at all.
  label?: string;
  radius?: string;
  // The gallery's secondary squares override both of these; nothing else does.
  ratio?: number;
  fit?: "contain" | "cover";
  maxHeight?: string;
  sizes?: string;
  // A feed's lead tile is the largest thing on screen and worth preloading;
  // everything below the fold is not. `priority` is deprecated in Next 16 in
  // favour of `preload`.
  preload?: boolean;
  testId?: string;
  onOpen?: () => void;
};

export function MediaTile({
  src,
  mimeType,
  poster,
  durationMs,
  autoplay = true,
  surface = "full",
  altText,
  sourceRatio,
  label = "Media",
  radius = "var(--radius-medium)",
  ratio,
  fit,
  maxHeight = "var(--media-max-height)",
  // Media runs the full width of a phone-width card, and the content column is
  // capped at 42rem — so one breakpoint describes every case the product has.
  sizes = "(max-width: 42rem) 100vw, 42rem",
  preload = false,
  testId,
  onOpen,
}: MediaTileProps) {
  const reserved = ratio ?? tileRatio(sourceRatio);
  const objectFit = fit ?? fitFor(sourceRatio);
  const alt = altText ?? "";
  // AN EXPLICIT `ratio` NAMES A FIXED FRAME — the comment scale's 220px
  // square, the gallery's secondary squares — and that frame is capped in
  // both axes at once: `aspect-ratio` with a definite `width: 100%` lets a
  // `max-height` take its bite out of the height alone, so bounding the
  // WIDTH by what the cap allows at this ratio (`max-width: calc(<cap> *
  // <ratio>)`) is what keeps the box the shape it was told to be, at the
  // cost of narrowing on a short viewport.
  //
  // THE DEFAULT FRAME CARRIES NO SUCH CAP. Its ratio comes from `tileRatio`,
  // already clamped at the 4:5 portrait bound, so nothing it reserves is
  // ever taller than that by construction. A second, viewport-tied height
  // cap stacked on an already-bounded ratio only fights the ratio instead of
  // settling anything — reshaping the frame where width stays definite, or
  // narrowing it for no reason where width is compensated. The default frame
  // stays full-width and lets the clamped ratio alone say its shape.
  const explicitShape = ratio !== undefined;
  const frameStyle = explicitShape
    ? {
        aspectRatio: cssRatio(reserved),
        maxHeight,
        maxWidth: `calc(${maxHeight} * ${reserved})`,
        // The tile no longer always fills its column, so it has to say where
        // it sits: centred, like every other capped surface in the app.
        marginInline: "auto",
        borderRadius: radius,
      }
    : {
        aspectRatio: cssRatio(reserved),
        borderRadius: radius,
      };

  // A VIDEO IS NOT A TILE WITH A PLAY BUTTON: it carries its own controls, and
  // it is never wrapped in the `onOpen` button below, because a control surface
  // inside a button steals every press the reader aims at the scrubber.
  //
  // IT STILL TAKES A FRAME. A clip keeps its native ratio CLAMPED TO TALL (the
  // reel round): 16:9 and 1:1 display true, anything taller than 4:5
  // centre-crops to it, and letterboxing exists nowhere — which is a crop
  // against a reserved shape, so the shape has to be reserved. A clip whose
  // shape the server has not probed yet gets no frame to be cropped against and
  // runs at its own, bounded by the height cap alone.
  if (isVideoAsset(mimeType) && src) {
    const known =
      // A COMMENT'S CLIP ALWAYS TAKES THE FRAME (ReplyMedia): one shape for
      // every comment attachment, so a thread does not change rhythm when a
      // clip lands in it — the square stands whether the shape is probed or not.
      surface === "reading" ||
      ratio !== undefined ||
      (typeof sourceRatio === "number" && Number.isFinite(sourceRatio) && sourceRatio > 0);
    const player = (
      <VideoPlayer
        src={src}
        poster={poster}
        altText={altText}
        durationMs={durationMs}
        autoplay={autoplay}
        surface={surface}
        framed={known}
        testId={testId}
      />
    );
    if (!known) return player;
    return (
      <span
        data-testid={testId ? `${testId}-frame` : undefined}
        style={frameStyle}
        className="relative block w-full min-h-0 overflow-hidden bg-surface-container-high"
      >
        {player}
      </span>
    );
  }

  const frame = (
    <span
      data-testid={testId}
      style={frameStyle}
      className="relative block w-full min-h-0 overflow-hidden bg-surface-container-high"
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          // Served media is display-ready by construction — the composer
          // re-encodes to WebP at display size before upload and the server
          // keeps that single rendition — so the optimizer would only
          // re-encode bytes that need no work, and it refuses private-IP
          // origins besides (the dev topology). The bytes are fetched as
          // stored.
          unoptimized
          style={{ objectFit }}
        />
      ) : (
        // No source: the region still reserves its space and says what belongs
        // there. Never invent imagery — an empty tile is honest, a stock photo
        // is not.
        <span className="absolute inset-0 grid place-items-center text-label-medium text-on-surface-variant">
          {label}
        </span>
      )}
    </span>
  );

  if (!onOpen) return frame;

  return (
    <button
      type="button"
      onClick={onOpen}
      // The tile's accessible name is the alt text where there is one; a
      // decorative tile still needs the control to say what it does, or the
      // button reads as unlabelled.
      aria-label={alt === "" ? "Open the picture" : `Open the picture: ${alt}`}
      className="cg-focus block w-full cursor-pointer"
    >
      {frame}
    </button>
  );
}
