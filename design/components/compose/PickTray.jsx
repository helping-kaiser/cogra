import React from "react";
import { InlineAction } from "../core/Button.jsx";

/* The pick step's tray (item 17, the conformance round): the band under the
   caption that says what has been picked so far — "Picked · N", the way into
   the Show all sheet, and the thumbnails themselves.

   IT IS THE PART OF THE STEP THAT DOES NOT CHANGE. Below the tray's hairline
   the four pick boards diverge completely — the device gallery grid on the
   phone, a dashed drop region on the web, an inert grid once a clip is staged,
   a list of refusals when files were turned away. Above it they are the same
   band to the pixel. So the tray ends where its own `borderBottom` ends, and
   what follows is the board's business, not the master's.

   THE THUMBNAILS ARE CHILDREN, not a prop. Every board tiles the same
   `MediaThumb` but asks it for something different — a cover badge, a remove
   X, a 114×64 video frame with its own remove label — and a tray that took an
   items array would have to grow a prop for each. The tray owns the band; the
   caller owns the pictures.

   "SHOW ALL" IS A REAL BUTTON (jakob, ruling D). It was drawn as a span, which
   is a link that cannot be reached by keyboard, cannot be pressed, and tells a
   screen reader nothing — the one control on the band, and the only inert
   thing on it. It is the bare primary word at the size the band is set in, so
   `InlineAction size="sm"` IS its resting look, value for value: the state
   layer, the focus ring and the 48px target arrive with it and nothing on the
   band moves.

   NO "Show all" WHEN THERE IS NOTHING TO SHOW: one staged clip is not a set to
   reorder, so the video board omits `onShowAll` and the count stops being a
   flex row — it is the only thing on its line, so it does not need to push
   anything to the end of one. */

const COUNT = {
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  fontWeight: "var(--text-label-small--font-weight)",
  letterSpacing: "0.5px",
  color: "var(--text-secondary)",
};

export function PickTray({ count, onShowAll, showAllLabel = "Show all", caption, clip = false, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 24px 12px", borderBottom: "1px solid var(--border-hairline)" }}>
      {onShowAll ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ flex: 1, ...COUNT }}>Picked · {count}</span>
          <InlineAction size="sm" onClick={onShowAll}>
            {showAllLabel}
          </InlineAction>
        </div>
      ) : (
        <span style={COUNT}>Picked · {count}</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: clip ? "hidden" : undefined }}>
        {children}
        {caption && (
          <span style={{ flex: 1, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
