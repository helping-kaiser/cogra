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
        <CropViewport src="gallery-market.jpg" shape="rect" height={192} scale={1.15} origin="50% 45%" />
        <QuietNote>Drag to move, pinch to zoom.</QuietNote>
        <QuietNote>The cover takes the video's shape.</QuietNote>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
