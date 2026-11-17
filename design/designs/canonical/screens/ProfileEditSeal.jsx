/* The profile edit's seal (profile round, item 23): every change to a profile
   is a signed act, so Save gets the same "What you sign" moment the picture
   already has (AvatarSeal) — the acts card is the master ActsCard; the "?" is
   copy-voice's "Changing your profile". 
   THE `state` CHIP'S `signing` IS THE SEAL CLOSED ON (round 37, jakob
   2026-11-11: Close on every seal). From the press on `Sign the change`
   the act is done: past 200ms it reads `Signing the change…` over Back,
   which reads `Close` from the press itself; it, the arrow and the X close
   the seal and the change goes on. Its wait and its answer belong where it lands, the profile, by `SigningAfterClose`'s edit form — the profile's own head standing as it was with the row line under it; that placement is not drawn yet (backlog 165). */
/* REGISTERED under the `profileEditSeal` prefix (round 48, seam 323-11 and 323-6), `keptPicksSeal`'s names: `header`, the card `acts` (`ActsCard`'s `actRow` keyed by place, and `total`), the `note`, and the `foot` — its two copies keyed by the `state` chip's value. Names only: not a pixel moves. */
/* THE UPLOAD GATE (round 50, act 3): a new picture from the edit uploads
   after its crop, and the seal waits on it — `uploading` the running gate,
   `Uploading 0 of 1 — signing waits for the picture.` with `Sign the change`
   enabled (a press waits, then signs); `upload-failed` its fault reading
   with `Retry` and the commit disabled. `AvatarSeal`'s words and values. */
export const NODE = "profileEditSeal";
/* THE `holds` CHIP (round 50, jakob 2026-11-17, his 8): what the change
   holds. `new` is the drawn sample — a new picture with the bio and website,
   the new picture in the head. `removed` is `Remove picture` signed from the
   edit with nothing else changed: the head wears the monogram and the row
   reads `The picture removed`. The row's grammar (copy-voice, *The profile's
   seal*): `A new` and the changed parts in the edit's order — picture,
   display name, bio, website — joined `, ` and ` and `; a removed picture
   reads `The picture removed` alone and `, the picture removed` after the
   others. `all` is the longest reading, every part changed, which runs to
   the row's second line (jakob 2026-11-17, C4: the row wraps, never cut
   off). Only the value's words follow the chip; no path moves. */
export const PROPS = {
  state: { editor: "enum", options: ["rest", "signing", "uploading", "upload-failed"], default: "rest" },
  holds: { editor: "enum", options: ["new", "removed", "all"], default: "new" },
};
export const VALS = `restFootShown: this.props.state === "rest" ? "flex" : "none", signFootShown: this.props.state === "signing" ? "flex" : "none", uploadingFootShown: this.props.state === "uploading" ? "flex" : "none", failedFootShown: this.props.state === "upload-failed" ? "flex" : "none", newShown: this.props.holds === "new" ? "inline" : "none", removedShown: this.props.holds === "removed" ? "inline" : "none", allShown: this.props.holds === "all" ? "inline" : "none", photoShown: this.props.holds === "removed" ? "none" : "flex", monoShown: this.props.holds === "removed" ? "flex" : "none"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="Leave" help="Changing your profile" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "{{photoShown}}", flex: "none" }}>
            <MonogramAvatar name="Sol Ferreira" size={64} src="comment-camera.jpg" />
          </span>
          <span style={{ display: "{{monoShown}}", flex: "none" }}>
            <MonogramAvatar name="Sol Ferreira" size={64} />
          </span>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-label-large)", letterSpacing: "var(--text-label-large--letter-spacing)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              Your profile
            </span>
          </span>
        </div>

        <ActsCard node="acts" rows={[{ label: "Profile", value: <><span style={{ display: "{{newShown}}" }}>A new picture, bio and website</span><span style={{ display: "{{removedShown}}" }}>The picture removed</span><span style={{ display: "{{allShown}}" }}>A new picture, display name, bio and website</span></>, count: "1", countNoun: "profile change", wrap: true }]} total="1 thing, signed" />

        <QuietNote node="note">Every change to your profile is signed in your name and stays in your public record.</QuietNote>

        <div style={{ flex: 1 }} />

        <div style={{ display: "{{restFootShown}}", flexDirection: "column" }} data-node-chip="state" data-node-key="rest">
          <SealFooter signLabel="Sign the change" busyLabel="Signing the change…" node="foot" />
        </div>
        <div style={{ display: "{{signFootShown}}", flexDirection: "column" }} data-node-chip="state" data-node-key="signing">
          <SealFooter signLabel="Sign the change" busy busyLabel="Signing the change…" node="foot" />
        </div>
        <div style={{ display: "{{uploadingFootShown}}", flexDirection: "column", gap: 16 }} data-node-chip="state" data-node-key="uploading">
          <UploadStatusLine done={0} total={1} node="gate" />
          <SealFooter signLabel="Sign the change" busyLabel="Signing the change…" node="foot" />
        </div>
        <div style={{ display: "{{failedFootShown}}", flexDirection: "column", gap: 16 }} data-node-chip="state" data-node-key="upload-failed">
          <UploadStatusLine failed onRetry={() => {}} node="gate" />
          <SealFooter signLabel="Sign the change" busyLabel="Signing the change…" disabled node="foot" />
        </div>
      </div>
    </>
  );
}
