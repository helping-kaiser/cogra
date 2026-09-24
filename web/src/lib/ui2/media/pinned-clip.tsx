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
//
// THE PINNED CLIP'S VEIL FACE (jakob 2026-09-24): a sensitive post's clip
// veils IN PLACE — the caller wraps it in a `BodyVeil` sharing the post's own
// reveal, never demoting it into the card — and the transport goes with it.
// `VideoPlayer` already refuses the playback claim while `useVeiled()` reads
// true (`video-player.tsx`, backlog item 103), but it draws its transport bar
// off `surface` alone, with no veil check of its own — so a `transport`
// surface behind a veil would still mount play/pause, skip and a scrubber
// nothing plays under. Reading the veil here and dropping to a surface that
// draws no bar is what keeps "nothing plays beneath a veil" true of the
// controls too, without reaching into `VideoPlayer` to add a check it was not
// built to need everywhere else it is used.

import { MediaTile } from "./media-tile";
import { useVeiled } from "./body-veil";

export function PinnedClip({
  src,
  mimeType,
  poster,
  altText,
  sourceRatio,
  durationMs,
  onOpenViewer,
  testId = "pinned-clip",
}: {
  src: string;
  mimeType: string;
  poster?: string | null;
  altText?: string | null;
  sourceRatio?: number | null;
  durationMs?: number | null;
  /**
   * Where the clip's own tap goes (`PinnedClip.jsx:19-20` — "the tap on it is
   * the surface's to wire: back into the stream where the reader came from it,
   * and into the fullscreen viewer everywhere else").
   *
   * THE STREAM HALF IS SLICE 3's. `Reel` is not built, so the graph's other
   * case (`PostDetailVideo` via 3 — "came from the stream — the clip expands
   * back into it, the reader's place held") has no destination yet; the viewer
   * half is wired and the reel half lands with the stream.
   */
  onOpenViewer?: () => void;
  testId?: string;
}) {
  // Read off the nearest `BodyVeil`, if the caller put one around this clip
  // (a sensitive post's does). `transport` is the only surface that draws a
  // bar, so falling back to `full` while veiled is what keeps that bar out of
  // the tree entirely rather than merely blurred and still there to tab into
  // — see the veil-face note above.
  const veiled = useVeiled();
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
        // `VideoPlayer` itself refuses the claim while veiled either way.
        autoplay
        surface={veiled ? "full" : "transport"}
        // The media meets the screen's own sides here: there is no card around
        // it to round against (`PinnedClip.jsx:28` — `radius="0px"`).
        radius="0px"
        onOpen={onOpenViewer}
        testId={`${testId}-media`}
      />
    </div>
  );
}
