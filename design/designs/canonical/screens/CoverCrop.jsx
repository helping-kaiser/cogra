/* The cover's crop (video conform round, 2026-09-03). A cover chosen from the
   gallery is any shape the gallery holds; the clip is one shape. So the
   gallery path — the cover row's "A picture" tile, at both scales — goes
   through a crop before it comes back to the step that asked for it.

   A FRAME NEEDS NO CROP: it was cut from the clip and already carries the
   clip's shape. Only the picture of your own can disagree with the video, so
   only it is asked to fit.

   THE SHAPE IS LOCKED, like the profile picture's circle (AvatarCrop, whose
   construction this is): the crop viewport wears the video's display shape at
   the scale it will be seen — the clip's own ratio in a post, the comment
   pager's square in a comment. There are no shape chips: choosing a shape
   here would let the cover disagree with the thing it is the face of. */
export function Screen() {
  return (
    <>
      <WizardHeader title="The cover" leaveLabel="Leave — your draft is kept" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 16px", overflow: "hidden" }}>
        <div style={{ position: "relative", width: 390, height: 390, margin: "0 -24px", overflow: "hidden", flex: "none" }}>
          <img
            src="gallery-market.jpg"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scale(1.15)", transformOrigin: "50% 45%" }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 24,
              top: 99,
              width: 342,
              height: 192,
              borderRadius: "var(--radius-small)",
              boxShadow: "0 0 0 400px rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxSizing: "border-box",
            }}
          />
        </div>
        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Drag to move, pinch to zoom.
        </p>
        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          The cover takes the video's shape.
        </p>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
