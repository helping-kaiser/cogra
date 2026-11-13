/* The profile picture's crop (media slice): the one image a profile has —
   circular 1:1, drag and pinch. Reached two ways (jakob 2026-09-01): the
   avatar badge on one's own profile — the standalone shortcut, Next goes to
   the picture's own seal — and Change picture on the edit screen, where Next
   returns to the edit instead: ONE seal covers picture and fields together,
   so nobody pays twice for one profile update.

   ONE CROP MODEL (jakob 2026-11-11, seam 301): the circle is a FIXED frame,
   342 × 342 at top 24 in the 390 × 390 stage (`CropViewport`'s inset 24),
   and the PICTURE moves (drag) and zooms (pinch, or the zoom track) under it;
   outside the circle the picture stays in view, darkened.

   THE ZOOM IS ON SCREEN (the K13 round): `CropZoom` under the circle, its
   thumb at this crop's 1.2× between the fill (1×) and about 4×, on both
   platforms; the focused stage moves the picture with the arrow keys
   (`CropViewport`), 1 % a press, 10 % with Shift (jakob 2026-10-05). No line
   says how to move it (round 44, the removable-text pass). */
export function Screen() {
  return (
    <>
      <WizardHeader title="Your picture" leaveLabel="Leave" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 16px", overflow: "hidden" }}>
        <CropViewport src="comment-camera.jpg" shape="circle" scale={1.2} origin="50% 35%" />
        <CropZoom scale={1.2} />
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
