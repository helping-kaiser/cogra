import React from "react";
import { MediaAttachment } from "./MediaAttachment.jsx";
import { SensitiveVeil } from "../honesty/SensitiveVeil.jsx";

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
   came from it, and into the fullscreen viewer everywhere else.

   THE PINNED CLIP'S VEIL FACE (jakob 2026-09-24, the pinned clip's veil face):
   the body veils as one and revealing moves nothing, so a sensitive video post's
   pinned clip veils IN PLACE rather than demoting into the card below it — the
   veil sits where the clip always sits. The transport goes with it: under the
   backlog-103 ruling nothing plays beneath a veil, so the face is the whole
   surface and its only affordance is the reveal. */

export function PinnedClip({ item, elapsed, duration, progress, playing = true, sensitive }) {
  const clip = (
    <MediaAttachment
      {...item}
      controls={sensitive ? "none" : "transport"}
      radius="0px"
      playing={sensitive ? false : playing}
      elapsed={elapsed}
      duration={duration}
      progress={progress}
    />
  );
  return (
    <div style={{ flex: "none", background: "#000" }}>
      {sensitive ? (
        <SensitiveVeil kind="media" reason={sensitive.reason} source={sensitive.source} radius="0px">
          {clip}
        </SensitiveVeil>
      ) : (
        clip
      )}
    </div>
  );
}
