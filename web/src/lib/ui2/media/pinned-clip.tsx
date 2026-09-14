"use client";

// THE PINNED CLIP — the top of a video post's detail view
// (`design/components/media/PinnedClip.jsx`).
//
// IT SITS ABOVE THE CARD, NOT INSIDE IT, "which is why the author chip leads
// the CARD on that surface rather than the screen. On every other surface the
// chip sits above the content; here the content the reader is already watching
// sits above everything, and the card beneath it is the post as it always
// reads" (`PinnedClip.jsx:9-12`).
//
// IT IS PINNED, not merely first. The board stands it OUTSIDE the scrolling
// column — `flex: "none"` beside a `DetailColumn` that owns the overflow
// (`screens/_shared.jsx:666-672`) — so the body rises beneath a clip that stays
// put and stays playing. A page that scrolls as one document says the same
// thing with `position: sticky`.
//
// THE GROUND IS BLACK (`PinnedClip.jsx:24` — `background: "#000"`), "so a clip
// that does not fill the frame's width sits on the same ground the viewer would
// give it".
//
// IT CARRIES THE FULL TRANSPORT (`controls="transport"`), the ladder's second
// rung: the reader opened this clip on purpose.

import { MediaTile } from "./media-tile";

export function PinnedClip({
  src,
  mimeType,
  poster,
  altText,
  sourceRatio,
  durationMs,
  testId = "pinned-clip",
}: {
  src: string;
  mimeType: string;
  poster?: string | null;
  altText?: string | null;
  sourceRatio?: number | null;
  durationMs?: number | null;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      // `top-0` rather than under a header: the detail's header scrolls with
      // the page, and a clip that stopped short of the edge would leave a band
      // of page showing above it on the way past.
      className="sticky top-0 z-10"
      // A LITERAL, not a role: this is the ground behind media, and the
      // viewer's own ground is black in both themes — a surface role would
      // make the band under a clip change colour with the theme while the
      // clip beside it did not.
      style={{ background: "#000" }}
    >
      <MediaTile
        src={src}
        mimeType={mimeType}
        poster={poster}
        altText={altText}
        sourceRatio={sourceRatio}
        durationMs={durationMs}
        // The clip pins still playing — it is the thing the reader came for.
        autoplay
        surface="transport"
        // The media meets the screen's own sides here: there is no card around
        // it to round against (`PinnedClip.jsx:28` — `radius="0px"`).
        radius="0px"
        testId={`${testId}-media`}
      />
    </div>
  );
}
