import React from "react";

/* The crop surface (item 17, the conformance round): the picture at the size
   it will be cut, with everything outside the cut darkened.

   THE MASK IS ONE BOX SHADOW, not four dimming panels. `0 0 0 400px` spreads a
   45% black outward from the window's own edges, so the darkened region is
   whatever the frame has left over — no arithmetic, nothing to keep in sync
   when the window moves, and the hairline that marks the cut is the same box's
   border. 400px is simply larger than the frame's own 390.

   THE SHAPE IS LOCKED TO WHAT THE PICTURE WILL BE. A profile picture is shown
   in a circle everywhere it appears, so it is cut in a circle; a video's cover
   is shown at the clip's ratio, so it is cut at that ratio. There are no shape
   chips on either — choosing a shape here would let the result disagree with
   the thing it is the face of.

   THE WINDOW IS ALWAYS CENTRED, and that is why it takes a height and not a
   position: it is inset `inset` from each side, and the leftover height splits
   evenly above and below. The circle's 342 square lands at top 24, the cover's
   342×192 at top 99, and neither board has to state a coordinate. */

export function CropViewport({
  src,
  alt = "",
  shape = "circle",
  scale = 1,
  origin = "50% 50%",
  size = 390,
  inset = 24,
  height,
}) {
  const width = size - inset * 2;
  const windowHeight = height ?? width;
  return (
    <div style={{ position: "relative", width: size, height: size, margin: `0 -${inset}px`, overflow: "hidden", flex: "none" }}>
      <img
        src={src}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: `scale(${scale})`, transformOrigin: origin }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: inset,
          top: (size - windowHeight) / 2,
          width,
          height: windowHeight,
          borderRadius: shape === "circle" ? "var(--radius-full)" : "var(--radius-small)",
          boxShadow: "0 0 0 400px rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
