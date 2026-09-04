// THE GALLERY IS A PAGER (jakob 2026-08-31, design/readme.md §"The media slice").
//
// Every picture in a post shares the post's one crop shape (D17), so the honest
// layout is ONE FRAME AT THAT SHAPE, SWIPED: each picture is shown whole,
// exactly as its author shaped it, and the card's height is one frame's height
// however many pictures ride it. Dots below carry the position — dots only,
// never a "1/n" count pill, which the ruling rejects.
//
// The earlier lead-tile-plus-square-strip layout is REJECTED and gone: its
// secondary squares re-cropped frames the author had deliberately shaped, which
// half-undid the one-crop ruling it was supposed to serve.
//
// Every frame renders at the ONE frame ratio — the explicit `ratio`, else the
// first item's — so an uncropped set (a comment's pictures, which never crop)
// passes a fixed frame and each whole frame is fitted inside it. A pager whose
// height changed per swipe would bounce the card under the reader's thumb.
//
// The cap is authoring-side (ten per post, four per comment); the gallery
// renders what it is given.

"use client";

import { useEffect, useRef, useState } from "react";

import { tileRatio } from "./aspect";
import { MediaTile, type MediaTileProps } from "./media-tile";
import type { PlayerSurface } from "./video-player";

/**
 * One entry in a gallery — always a real attachment, never the tile's
 * asset-less placeholder, so `mimeType` is REQUIRED here even though
 * `MediaTile` takes it optionally. That is what makes an omitted
 * `mimeType` selection a compile error at the read that built the items
 * rather than an image tile where a player belongs.
 */
export type GalleryItem = Pick<
  MediaTileProps,
  "src" | "altText" | "sourceRatio" | "label" | "poster" | "durationMs"
> & { mimeType: string };

export type { PlayerSurface } from "./video-player";

// Two ratios agree when they round to the same hundredth: the server states the
// shape in lowest terms off the bytes, so "4:5" and a 1080×1350 export are the
// same shape arriving with different rounding, not two different frames.
function sameShape(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/**
 * How one item sits in the shared frame.
 *
 * `cover` only where the picture already IS the frame's shape — there it avoids
 * a sub-pixel seam at the edges and crops nothing. Anything else is fitted
 * WHOLE (`contain`) with the reserved surface showing at the sides, because the
 * layout never decides the author's crop.
 */
function fitInFrame(sourceRatio: number | null | undefined, frameRatio: number): "contain" | "cover" {
  if (typeof sourceRatio !== "number" || !Number.isFinite(sourceRatio) || sourceRatio <= 0) {
    return "contain";
  }
  return sameShape(sourceRatio, frameRatio) ? "cover" : "contain";
}

export function MediaGallery({
  items,
  ratio,
  radius = "var(--radius-medium)",
  maxHeight,
  preloadLead = false,
  surface = "full",
  testId = "media-gallery",
  onOpen,
}: {
  items: readonly GalleryItem[];
  /** `reading` is the comment's form — the sound control and nothing else. */
  surface?: PlayerSurface;
  // The one frame every picture renders at. Omitted, the first picture's shape
  // sets it — which is exactly right for a post, where the whole set shares one.
  ratio?: number;
  radius?: string;
  maxHeight?: string;
  preloadLead?: boolean;
  testId?: string;
  onOpen?: (index: number) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  // The swipe is the gesture; these are the routes that do not need one. The
  // canvas draws no arrows, so the keyboard route is offered without painting
  // a control for it (web.md §Accessibility: "the canvas draws no framing
  // controls, so the route is offered without painting one").
  const goTo = (index: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // jsdom leaves `scrollTo` off elements, and a browser with no smooth
    // scrolling still has to land on the page — so the scroll is best-effort
    // and the readout below is what actually moves.
    strip.scrollTo?.({ left: clamped * strip.clientWidth, behavior: reduced ? "auto" : "smooth" });
    // jsdom and reduced-motion both land without firing a scroll event, so the
    // readout follows the intent rather than waiting for the scroll to report.
    setPage(clamped);
  };

  // Keep the dots honest when the reader swipes rather than types.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onScroll = () => {
      if (strip.clientWidth === 0) return;
      const next = Math.round(strip.scrollLeft / strip.clientWidth);
      setPage((current) => (next === current ? current : next));
    };
    strip.addEventListener("scroll", onScroll, { passive: true });
    return () => strip.removeEventListener("scroll", onScroll);
    // The strip is only rendered on the multi-item path, so at mount the ref is
    // null for a gallery of nought or one. The listener has to follow the
    // element rather than the mount, or a gallery that grows past one swipes
    // with a readout stuck on "Picture 1".
  }, [items.length]);

  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <MediaTile
        {...items[0]}
        ratio={ratio}
        radius={radius}
        maxHeight={maxHeight}
        preload={preloadLead}
        surface={surface}
        testId={`${testId}-lead`}
        onOpen={onOpen ? () => onOpen(0) : undefined}
      />
    );
  }

  const frameRatio = ratio ?? tileRatio(items[0].sourceRatio);

  return (
    <div className="flex flex-col">
      <div
        ref={stripRef}
        data-testid={`${testId}-strip`}
        // A scroll container is only reachable by keyboard if it can take
        // focus; `group` names it so the reader is told what they entered
        // rather than landing in an unlabelled box.
        role="group"
        aria-label={`${items.length} pictures`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            goTo(page + 1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            goTo(page - 1);
          } else if (event.key === "Home") {
            event.preventDefault();
            goTo(0);
          } else if (event.key === "End") {
            event.preventDefault();
            goTo(items.length - 1);
          }
        }}
        // `scrollbar-width: none` keeps the strip's own bar off a surface that
        // is already telling the reader where they are with the dots.
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
        className="cg-focus flex overflow-x-auto"
      >
        {items.map((item, index) => (
          <div
            // The same asset can be attached twice, so the src alone is not an
            // identity; the position is what distinguishes the two frames.
            key={`${index}:${item.src ?? ""}`}
            style={{ scrollSnapAlign: "start" }}
            className="w-full flex-none"
          >
            <MediaTile
              {...item}
              ratio={frameRatio}
              fit={fitInFrame(item.sourceRatio, frameRatio)}
              radius={radius}
              maxHeight={maxHeight}
              preload={index === 0 && preloadLead}
              surface={surface}
              testId={`${testId}-page-${index}`}
              onOpen={onOpen ? () => onOpen(index) : undefined}
            />
          </div>
        ))}
      </div>
      {/* The dots are a READOUT, not ten targets — the gesture is the swipe and
          the keys are the route. Live, so a swipe says where it landed to a
          reader who cannot see the dots move. */}
      <div
        data-testid={`${testId}-dots`}
        aria-live="polite"
        aria-label={`Picture ${page + 1} of ${items.length}`}
        className="flex justify-center gap-1.5 pt-2"
      >
        {items.map((item, index) => (
          <span
            key={`${index}:${item.src ?? ""}`}
            aria-hidden="true"
            style={{
              background: index === page ? "var(--primary)" : "var(--border-hairline)",
            }}
            className="size-1.5 rounded-full"
          />
        ))}
      </div>
    </div>
  );
}
