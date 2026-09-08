import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* The video's face (item 17, the conformance round): the strip of frames cut
   from the clip, plus the one tile that is not a frame at all.

   FOUR FRAMES, NOT THREE (jakob 2026-09-03): 1s, 10%, 50%, 90% of the clip. 1s
   clears the fade-in black that t=0 so often is, and the three ratios spread
   the rest. On a clip short enough that two samples land on the same frame they
   collapse and fewer tiles show — offering the same picture twice is a choice
   that isn't one, so the strip takes the frames it is given and draws no
   placeholder for a fifth.

   THE CHOSEN FRAME IS OUTLINED, THE REST ARE DIMMED. Selection is the primary
   outline offset off the tile, not a check badge — the tiles are 56px and a
   badge at that size covers the thing being chosen. The unchosen frames sit at
   65% so the strip reads as one picture framed several ways, which is what it
   is.

   THE LAST TILE IS A DIFFERENT KIND OF THING and says so by not being a
   photograph: a dashed square with the picture glyph, the same shape as the
   frames so the row still scans as one strip. It is the way out to the gallery,
   and a picture chosen there goes through `CropViewport` first, because a
   picture of your own is the only cover that can disagree with the clip's
   shape.

   THE ROW IS THE WHOLE CLUSTER — the "Cover" field label, the strip, and the
   line underneath — because those three only ever appear together. The comment
   composer inlines it at 56px and the post's cover stage draws it larger; both
   want the label and the line. */

const TILE = {
  width: 56,
  height: 56,
  borderRadius: "var(--radius-small)",
  overflow: "hidden",
  flex: "none",
};

const FILL = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

export function CoverRow({
  label = "Cover",
  frames = [],
  selected = 0,
  caption = "A frame, or a picture of your own.",
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          fontWeight: "var(--text-label-large--font-weight)",
          letterSpacing: "var(--text-label-large--letter-spacing)",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        {frames.map((frame, index) => (
          <div
            key={frame.src ? `${frame.src}-${index}` : index}
            className="cg-cover-frame"
            style={
              index === selected
                ? { ...TILE, outline: "2px solid var(--primary)", outlineOffset: 1 }
                : { ...TILE, opacity: 0.65 }
            }
          >
            <img src={frame.src} alt="" style={frame.transform ? { ...FILL, transform: frame.transform } : FILL} />
          </div>
        ))}
        <div
          className="cg-cover-own"
          style={{
            width: 56,
            height: 56,
            borderRadius: "var(--radius-small)",
            border: "1px dashed var(--border-field)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            boxSizing: "border-box",
            flex: "none",
          }}
        >
          <Icon name="image" size={20} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
        {caption}
      </p>
    </div>
  );
}
