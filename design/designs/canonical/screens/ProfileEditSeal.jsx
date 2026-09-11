/* The profile edit's seal (profile round, item 23): every change to a profile
   is a signed act, so Save gets the same "What you sign" moment the picture
   already has (AvatarSeal) — the acts card is the master ActsCard; the "?" is
   copy-voice's "Changing your profile". */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="Leave" stageLabel="Last step" help="Changing your profile" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MonogramAvatar name="Sol Ferreira" size={64} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              Your profile
            </span>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
              Picture, name, bio, and website — one signed change.
            </span>
          </span>
        </div>

        <ActsCard rows={[{ label: "Profile", value: "A new picture, bio and website", count: "1 action" }]} total="1 signed action" />

        <QuietNote>Every change to your profile is signed in your name and stays in your public record.</QuietNote>

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign the change" />
      </div>
    </>
  );
}
