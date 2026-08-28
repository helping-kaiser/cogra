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

export type MediaTileProps = {
  src?: string | null;
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

  const frame = (
    <span
      data-testid={testId}
      style={{
        aspectRatio: cssRatio(reserved),
        maxHeight,
        borderRadius: radius,
      }}
      className="relative block w-full min-h-0 overflow-hidden bg-surface-container-high"
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
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
