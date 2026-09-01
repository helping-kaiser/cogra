/* The profile picture's crop (media slice): the one image a profile has —
   circular 1:1, drag and pinch. Minimal flow by ruling; the full profile
   screen is its own backlog item. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Your picture" leaveLabel="Leave" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 16px", overflow: "hidden" }}>
        <div style={{ position: "relative", width: 390, height: 390, margin: "0 -24px", overflow: "hidden", flex: "none" }}>
          <img
            src="comment-camera.jpg"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scale(1.2)", transformOrigin: "50% 35%" }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 24,
              top: 24,
              width: 342,
              height: 342,
              borderRadius: "var(--radius-full)",
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
          One picture, shown everywhere you appear.
        </p>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
