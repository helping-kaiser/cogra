import React from "react";
import { MediaAttachment } from "./MediaAttachment.jsx";

/* THE PINNED CLIP (readme §13, the reel round) — the top of a video post's
   detail view, and what the stream's squish morph leaves behind: the clip
   shrinks out of the stream, pins here still playing, and the post rises
   beneath it.

   IT SITS ABOVE THE CARD, not inside it, which is why the author chip leads the
   CARD on that surface rather than the screen. On every other surface the chip
   sits above the content; here the content the reader is already watching sits
   above everything, and the card beneath it is the post as it always reads.

   IT CARRIES THE FULL TRANSPORT (`controls="transport"`), which is the ladder's
   second rung: the reader opened this clip on purpose. The ground behind it is
   black, so a clip that does not fill the frame's width sits on the same ground
   the viewer would give it.

   The tap on it is the surface's to wire: back into the stream where the reader
   came from it, and into the fullscreen viewer everywhere else. */

export function PinnedClip({ item, elapsed, duration, progress, playing = true }) {
  return (
    <div style={{ flex: "none", background: "#000" }}>
      <MediaAttachment
        {...item}
        controls="transport"
        radius="0px"
        playing={playing}
        elapsed={elapsed}
        duration={duration}
        progress={progress}
      />
    </div>
  );
}
