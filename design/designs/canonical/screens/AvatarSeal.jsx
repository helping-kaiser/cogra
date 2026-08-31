/* The profile picture's seal (media slice): every change to a profile is a
   signed act, so the new picture gets the same "What you sign" moment as a
   post — the acts card is the master ActsCard; the "?" is copy-voice's
   "Changing your picture". */
export function Screen() {
  return (
    <>
      <PageHeader
        title="What you sign"
        backHref="#"
        backLabel="Back"
        action={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>Last step</span>
            <SystemHelpDot ariaLabel="Changing your picture" />
          </span>
        }
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="comment-camera.jpg" alt="" style={{ width: 64, height: 64, borderRadius: "var(--radius-full)", objectFit: "cover", flex: "none" }} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              Your profile picture
            </span>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
              Shown everywhere you appear.
            </span>
          </span>
        </div>

        <ActsCard rows={[{ label: "Picture", value: "A new profile picture", count: "1 action" }]} total="1 signed action" />

        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Every change to your profile is signed in your name and stays in your public record.
        </p>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button style={{ width: "100%" }}>Sign the change</Button>
          <Button variant="text" style={{ width: "100%" }}>Back</Button>
        </div>
      </div>
    </>
  );
}
