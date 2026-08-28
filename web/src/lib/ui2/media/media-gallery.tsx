// One, two, or three-and-more, and nothing cleverer.
//
// The first tile leads at the post's own shape; the rest share a row of
// squares. That is what makes the reserved height a function of the COUNT
// ALONE — computable before anything loads, which is the reservation rule of
// the tile applied to a set. A gallery that grew a new row per image would
// change the height of every card below it as each one arrived.
//
// A fourth-and-beyond count shows three and a remainder rather than growing,
// for the same reason.

import { MediaTile, type MediaTileProps } from "./media-tile";

export type GalleryItem = Pick<MediaTileProps, "src" | "altText" | "sourceRatio" | "label">;

export function MediaGallery({
  items,
  radius = "var(--radius-medium)",
  preloadLead = false,
  testId = "media-gallery",
  onOpen,
}: {
  items: readonly GalleryItem[];
  radius?: string;
  preloadLead?: boolean;
  testId?: string;
  onOpen?: (index: number) => void;
}) {
  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <MediaTile
        {...items[0]}
        radius={radius}
        preload={preloadLead}
        testId={`${testId}-lead`}
        onOpen={onOpen ? () => onOpen(0) : undefined}
      />
    );
  }

  const [lead, ...rest] = items;
  const shown = rest.slice(0, 2);
  const remainder = rest.length - shown.length;

  return (
    <div
      data-testid={testId}
      style={{ maxHeight: "var(--media-max-height)" }}
      className="flex flex-col gap-0.5 overflow-hidden"
    >
      {/* THE CAP IS ON THE WHOLE GALLERY, not on each tile: the lead and the
          strip together have to leave the rest of the card on screen. Roughly
          60/40, because the lead is the media and the strip is only an index
          into the set. */}
      <MediaTile
        {...lead}
        radius={radius}
        preload={preloadLead}
        maxHeight="calc(var(--media-max-height) * 0.6)"
        // The lead is one of two or three tiles' worth of width at most, but it
        // still spans the card, so it keeps the full-width hint.
        testId={`${testId}-lead`}
        onOpen={onOpen ? () => onOpen(0) : undefined}
      />
      <div
        style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
        className="grid gap-0.5"
      >
        {shown.map((item, index) => (
          <div key={item.src ?? index} className="relative">
            {/* Secondary tiles CROP — `ratio: 1` and `fit: cover`. They are an
                index into the set, not the media itself, and the whole frame is
                one tap away in the viewer. This is the single exception to "the
                layout never decides the author's crop". */}
            <MediaTile
              {...item}
              ratio={1}
              fit="cover"
              radius={radius}
              maxHeight="calc(var(--media-max-height) * 0.4)"
              sizes="(max-width: 42rem) 50vw, 21rem"
              testId={`${testId}-tile-${index + 1}`}
              onOpen={onOpen ? () => onOpen(index + 1) : undefined}
            />
            {remainder > 0 && index === shown.length - 1 && (
              // The remainder counter sits over the last square. It is
              // `aria-hidden` because the tile beneath it is already a labelled
              // control and this is a count, not a second target — the reader
              // reaches the rest through the viewer either way.
              <span
                aria-hidden="true"
                data-testid={`${testId}-remainder`}
                style={{ borderRadius: radius, background: "var(--scrim-dialog)" }}
                className="pointer-events-none absolute inset-0 grid place-items-center text-title-medium text-inverse-on-surface"
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
