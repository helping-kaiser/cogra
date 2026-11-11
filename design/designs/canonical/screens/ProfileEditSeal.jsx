/* The profile edit's seal (profile round, item 23): every change to a profile
   is a signed act, so Save gets the same "What you sign" moment the picture
   already has (AvatarSeal) — the acts card is the master ActsCard; the "?" is
   copy-voice's "Changing your profile". 
   THE `state` CHIP'S `signing` IS THE SEAL CLOSED ON (round 37, jakob
   2026-11-11: Close on every seal). From the press on `Sign the change`
   the act is done: past 200ms it reads `Signing the change…` over Back,
   which reads `Close` from the press itself; it, the arrow and the X close
   the seal and the change goes on. Its wait and its answer belong where it lands, the profile, by `SigningAfterClose`'s edit form — the profile's own head standing as it was with the row line under it; that placement is not drawn yet (backlog 165). */
export const PROPS = { state: { editor: "enum", options: ["rest", "signing"], default: "rest" } };
export const VALS = `restFootShown: this.props.state === "signing" ? "none" : "flex", signFootShown: this.props.state === "signing" ? "flex" : "none", sealLeave: this.props.state === "signing" ? "Close" : "Leave"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="{{sealLeave}}" stageLabel="Last step" help="Changing your profile" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MonogramAvatar name="Sol Ferreira" size={64} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-label-large)", letterSpacing: "var(--text-label-large--letter-spacing)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              Your profile
            </span>
            <span style={{ fontSize: "var(--text-label-small)", letterSpacing: "var(--text-label-small--letter-spacing)", fontWeight: "var(--text-label-small--font-weight)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
              Picture, name, bio, and website — one signed change.
            </span>
          </span>
        </div>

        <ActsCard rows={[{ label: "Profile", value: "A new picture, bio and website", count: "1", countNoun: "profile change" }]} total="1 thing, signed" />

        <QuietNote>Every change to your profile is signed in your name and stays in your public record.</QuietNote>

        <div style={{ flex: 1 }} />

        <div style={{ display: "{{restFootShown}}", flexDirection: "column" }}>
          <SealFooter signLabel="Sign the change" busyLabel="Signing the change…" />
        </div>
        <div style={{ display: "{{signFootShown}}", flexDirection: "column" }}>
          <SealFooter signLabel="Sign the change" busy busyLabel="Signing the change…" />
        </div>
      </div>
    </>
  );
}
