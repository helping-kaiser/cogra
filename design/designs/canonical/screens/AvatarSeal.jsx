/* The profile picture's seal (media slice): every change to a profile is a
   signed act, so the new picture gets the same "What you sign" moment as a
   post — the acts card is the master ActsCard; the "?" is copy-voice's
   "Changing your picture". 
   THE `state` CHIP'S `signing` IS THE SEAL CLOSED ON (round 37, jakob
   2026-11-11: Close on every seal). From the press on `Sign the change`
   the act is done: past 200ms it reads `Signing the change…` over Back,
   which reads `Close` from the press itself; it, the arrow and the X close
   the seal and the change goes on. Its wait and its answer belong where it lands, the profile, by `SigningAfterClose`'s edit form — the profile's own head standing as it was with the row line under it; that placement is not drawn yet (backlog 165). */
/* REGISTERED under the `avatarSeal` prefix (round 48, seam 323-11 and 323-6), `keptPicksSeal`'s names: `header`, the card `acts` (`ActsCard`'s `actRow` keyed by place, and `total`), the `note`, and the `foot` — its two copies keyed by the `state` chip's value. Names only: not a pixel moves. */
export const NODE = "avatarSeal";
/* THE `state` CHIP'S `uploading` AND `upload-failed` (round 50; `uploading`
   the running gate, `Uploading 0 of 1 — signing waits for the picture.`,
   added in act 3 with the profile seal's). `upload-failed` (round 50, jakob 2026-11-17, his 9 —
   the upload case, backlog 270: the upload starts after the crop). The new
   picture did not reach CoGra while the seal waited on it: the gate's fault
   reading, `ReplySealUploadFailed`'s words exactly — `One picture didn't
   upload. Signing waits for it.` with `Retry` — over the foot, and `Sign the
   change` disabled until `Retry` re-gates. No `Remove it` on a seal: one
   stage back is the crop. `upload-refused` (round 51 act 2, jakob
   2026-11-17, B3) is that upload refused by the server: the gate's refused
   reading, `One picture didn't upload.` alone — no `Signing waits for it.`,
   which would wait for ever, and no `Retry` — with `Sign the change`
   disabled and `Back` the way out. */
export const PROPS = { state: { editor: "enum", options: ["rest", "signing", "uploading", "upload-failed", "upload-refused"], default: "rest" } };
export const VALS = `restFootShown: this.props.state === "rest" ? "flex" : "none", signFootShown: this.props.state === "signing" ? "flex" : "none", failedFootShown: this.props.state === "upload-failed" ? "flex" : "none", refusedFootShown: this.props.state === "upload-refused" ? "flex" : "none", uploadingFootShown: this.props.state === "uploading" ? "flex" : "none"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="Leave" help="Changing your picture" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MonogramAvatar name="Sol Ferreira" size={64} src="comment-camera.jpg" />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-label-large)", letterSpacing: "var(--text-label-large--letter-spacing)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              Your profile picture
            </span>
          </span>
        </div>

        <ActsCard node="acts" rows={[{ label: "Picture", value: "A new profile picture", count: "1", countNoun: "picture" }]} total="1 thing, signed" />

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
        <div style={{ display: "{{refusedFootShown}}", flexDirection: "column", gap: 16 }} data-node-chip="state" data-node-key="upload-refused">
          <UploadStatusLine refused node="gate" />
          <SealFooter signLabel="Sign the change" busyLabel="Signing the change…" disabled node="foot" />
        </div>
      </div>
    </>
  );
}
