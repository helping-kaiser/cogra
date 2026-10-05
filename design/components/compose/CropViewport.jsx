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
   342×192 at top 99, and neither board has to state a coordinate.

   THE DRAG HAS A NON-DRAG TWIN, AND THE PINCH A VISIBLE ONE (the K13 round;
   readme §10). Under the viewport stands `CropZoom`, a visible slider on both
   platforms — a desktop browser has no pinch, so zoom has to be on screen for
   everyone, not only for assistive tech. Its bounds are the crop's own: at
   the minimum the picture just fills the window (1×, nothing outside the
   picture can show), at the maximum it stands at about 4×. The viewport
   itself takes focus, and the arrow keys pan the picture inside the window,
   stopping where an edge of the picture meets the window's edge. A pinch
   moves the slider with it, and the slider moves the picture: one value, two
   ways to set it. */

export const CROP_ZOOM_MIN = 1;
export const CROP_ZOOM_MAX = 4;

export function CropViewport({
  src,
  alt = "",
  shape = "circle",
  scale = 1,
  origin = "50% 50%",
  size = 390,
  inset = 24,
  height,
  onPan,
}) {
  const width = size - inset * 2;
  const windowHeight = height ?? width;
  const onKeyDown = (event) => {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const move = moves[event.key];
    if (!move || !onPan) return;
    event.preventDefault();
    onPan(move[0], move[1]);
  };
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={CROP_PAN_NAME}
      onKeyDown={onKeyDown}
      className="cg-focus"
      style={{ position: "relative", width: size, height: size, margin: `0 -${inset}px`, overflow: "hidden", flex: "none" }}
    >
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

/* The viewport's and the slider's spoken names (flagged for blessing, the K13
   round): what the focused picture and the slider are for, in the reader's
   words. */
export const CROP_PAN_NAME = "Move the picture";
export const CROP_ZOOM_NAME = "Zoom";

/* THE ZOOM, ON SCREEN. The house slider (`StanceSlider`'s range input in
   `primary`) at the full width of the column, under the viewport, its thumb
   at the crop's current scale between `CROP_ZOOM_MIN` and `CROP_ZOOM_MAX`.
   No words beside it: the viewport above is what it acts on, and its name
   carries what it does. The input stands 48px tall, so the thumb's target is
   the system's minimum. */
export function CropZoom({ scale = CROP_ZOOM_MIN, onChange }) {
  return (
    // `data-field` for the flow badge, `TextField`'s reason: a range input is a
    // replaced element and cannot host the badge's ::after.
    <div data-field={CROP_ZOOM_NAME} style={{ flex: "none" }}>
      <input
        type="range"
        min={CROP_ZOOM_MIN}
        max={CROP_ZOOM_MAX}
        step={0.01}
        value={scale}
        aria-label={CROP_ZOOM_NAME}
        onChange={(event) => onChange && onChange(Number(event.target.value))}
        className="cg-focus"
        style={{ display: "block", width: "100%", height: "var(--touch-target-min)", margin: 0, accentColor: "var(--primary)" }}
      />
    </div>
  );
}
