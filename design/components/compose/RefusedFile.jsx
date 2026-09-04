import React from "react";
import { MediaThumb } from "./MediaThumb.jsx";
import { UploadErrorLine } from "./UploadNotice.jsx";

/* A file the surface turned away (item 17, the conformance round): the tile
   wearing `MediaThumb`'s failed badge, and beside it the words saying which
   rule the file broke.

   THE REFUSAL IS DRAWN WHERE THE FILE WAS OFFERED — never in a dialog, never
   in a snackbar. The author is looking at the pick step; the answer belongs on
   it, under the tray that took the rest.

   REMOVE IT IS THE ONLY WAY OUT, so no Retry is offered. Retrying cannot make
   a file smaller or a format readable — a control that would fail the same way
   twice is worse than no control, and `UploadErrorLine` drops the link when no
   `onRetry` is given. That is the difference between this and an upload that
   failed: one is a refusal, the other is a network.

   A FILE NOTHING CAN READ HAS NO PREVIEW, so the tile is empty on purpose
   rather than carrying a stand-in glyph. The empty square is the honest
   picture of a file the surface could not open.

   ONE FILE, ONE LINE, THE NEAREST REASON (jakob 2026-09-03): a file is judged
   on its own — size and format — before it is judged against the body it wants
   to join. So an oversized clip is refused by its cap, not by the mixed-kind
   rule it also breaks. */

export function RefusedFile({ src, alt = "", video = false, message, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <MediaThumb src={src} alt={alt} video={video} failed />
      <div style={{ flex: 1, minWidth: 0 }}>
        <UploadErrorLine message={message} onRemove={onRemove} />
      </div>
    </div>
  );
}
