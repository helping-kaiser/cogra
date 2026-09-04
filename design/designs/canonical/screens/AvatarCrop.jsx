/* The profile picture's crop (media slice): the one image a profile has —
   circular 1:1, drag and pinch. Reached two ways (jakob 2026-09-01): the
   avatar badge on one's own profile — the standalone shortcut, Next goes to
   the picture's own seal — and Change picture on the edit screen, where Next
   returns to the edit instead: ONE seal covers picture and fields together,
   so nobody pays twice for one profile update. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Your picture" leaveLabel="Leave" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 16px", overflow: "hidden" }}>
        <CropViewport src="comment-camera.jpg" shape="circle" scale={1.2} origin="50% 35%" />
        <QuietNote>Drag to move, pinch to zoom.</QuietNote>
        <QuietNote>One picture, shown everywhere you appear.</QuietNote>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
