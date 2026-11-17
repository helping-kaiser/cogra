/* Edit profile — the task flow off one's own header (profile round, item 23).
   Back arrow, no bar (a task flow, Q37). The picture keeps its own row here —
   the same crop-and-seal flow the header badge reaches (jakob 2026-09-01: the
   avatar is the frequent standalone change; the rare name/bio/website edits
   live here). Save sits at the bottom (the wizard ruling) and leads to the
   change's seal: every profile change is a signed act. The handle is
   deliberately absent — it is L2 account state and changes in Settings.
   It reads as a wizard stage, not a task page (jakob 2026-10-01): it leads
   to a seal, so `Save` keeps its pinned foot under the two-placement law. */
/* REGISTERED under the `profileEdit` prefix (round 48, seam 323-11 and 323-6), the credential forms' grammar: `header`, the picture's door `picture`, the fields `name`, `bio` and `website` (one-word names, so the sidecar's quoted strings never spell a node), and the commit `save`. Names only: not a pixel moves. */
/* THE `state` CHIP (round 50, jakob 2026-11-17, his 8, 9, 12 and 13). Each
   value is one moment of the same edit; the registered nodes stand once and
   only their look follows the chip, so no path changes its key.
   - `rest`, THE DEFAULT, is the edit as it opens: nothing is staged yet, so
     Save stays visible and inert and `Nothing to sign yet` stands on it —
     `EditComposeUnchanged`'s guard, the staged change and never a byte
     comparison. Sol has no picture, so the row is the monogram and
     `Change picture` alone.
   - `picture` is the same opening for a reader whose picture stands: the
     two buttons stand side by side, never one above the other (jakob
     2026-11-17). `Change picture` and `Remove picture` measure 133 + 8 + 135
     against the 262 the row leaves beside the 64px picture, so wherever two
     stand both take the short forms, `Change` · `Remove`, their spoken
     names still `Change picture` / `Remove picture`; a lone button keeps
     `Change picture`.
   - `changed` is the edit with a change staged: the line goes and Save
     answers.
   - `removed` is `Remove picture` pressed: the removal is staged, the
     monogram returns at once, and Save signs it with the rest under the one
     seal. Nothing is signed before the seal. `Undo` stands where `Remove`
     stood, in its style, and unstages the removal (jakob 2026-11-17, C2).
   - `upload-failed` is a new picture back from the crop whose upload failed
     (`Remove picture` hidden while a new picture is staged, C3):
     `One picture didn't upload.` with `Retry · Remove it` under the picture's
     row (`ComposeUploading`), and Save still answers — the seal is where
     signing waits for it (`ReplySealUploadFailed`).
   - `refused` is a write-rule refusal already known at Save: the line
     `You can't sign right now.` stands on Save in the row's quiet register
     (`RowWriteRule`), its "?" opening `Why signing waits`, and Save dims —
     nobody is sent to the seal. */
export const NODE = "profileEdit";
export const PROPS = { state: { editor: "enum", options: ["rest", "picture", "changed", "removed", "upload-failed", "refused"], default: "rest" } };
export const VALS = `monoShown: this.props.state === "picture" || this.props.state === "upload-failed" ? "none" : "flex", photoShown: this.props.state === "picture" || this.props.state === "upload-failed" ? "flex" : "none", removeShown: this.props.state === "picture" ? "inline-flex" : "none", undoShown: this.props.state === "removed" ? "inline-flex" : "none", changeLabel: this.props.state === "picture" || this.props.state === "removed" ? "Change" : "Change picture", uploadFailedShown: this.props.state === "upload-failed" ? "block" : "none", nothingShown: this.props.state === "rest" || this.props.state === "picture" ? "flex" : "none", refusedShown: this.props.state === "refused" ? "flex" : "none", saveOpacity: this.props.state === "rest" || this.props.state === "picture" || this.props.state === "refused" ? "var(--state-disabled)" : "1", saveCursor: this.props.state === "rest" || this.props.state === "picture" || this.props.state === "refused" ? "default" : "pointer"`;

const QUIET_LINE = {
  margin: 0,
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  fontWeight: "var(--text-label-small--font-weight)",
  letterSpacing: "var(--text-label-small--letter-spacing)",
  color: "var(--text-secondary)",
};

export function Screen() {
  return (
    <>
      <PageHeader title="Edit profile" backHref="#" backLabel="Back" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ display: "{{monoShown}}", flex: "none" }}>
              <MonogramAvatar name="Sol Ferreira" size={64} />
            </span>
            <span style={{ display: "{{photoShown}}", flex: "none" }}>
              <MonogramAvatar name="Sol Ferreira" size={64} src="comment-camera.jpg" />
            </span>
            <div style={{ display: "flex", flexWrap: "nowrap", gap: 8 }}>
              <Button variant="outline" size="sm" ariaLabel="Change picture" node="picture">{"{{changeLabel}}"}</Button>
              <Button variant="outline" size="sm" ariaLabel="Remove picture" style={{ display: "{{removeShown}}" }} node="remove">Remove</Button>
              <Button variant="outline" size="sm" ariaLabel="Undo removing the picture" style={{ display: "{{undoShown}}" }} node="undo">Undo</Button>
            </div>
          </div>
          <div style={{ display: "{{uploadFailedShown}}" }}>
            <UploadErrorLine onRetry={() => {}} onRemove={() => {}} node="uploadError" />
          </div>
        </div>
        <TextField node="name" label="Display name" corner="Optional" kind="name" cap={50} value="Sol Ferreira" />
        <TextField node="bio" label="Bio" corner="Optional" rows={3} cap={500} value="Field notes from the flats — salt, paper, and whatever the wind allows." />
        <TextField node="website" label="Website" corner="Optional" kind="url" autoComplete="url" enterKeyHint="go" cap={2048} value="solferreira.art" />
        <div style={{ flex: 1 }} />
        <div style={{ display: "{{nothingShown}}", flexDirection: "column" }}>
          <ActsFooter count={0} node="acts" />
        </div>
        <div role="status" style={{ display: "{{refusedShown}}", alignItems: "center", justifyContent: "center", gap: 4 }} data-node="refused">
          <p style={QUIET_LINE} data-node="line">You can&apos;t sign right now.</p>
          <HelpDot ariaLabel="Why signing waits" onOpen={() => {}} node="help" />
        </div>
        <Button style={{ width: "100%", opacity: "{{saveOpacity}}", cursor: "{{saveCursor}}" }} node="save">Save</Button>
      </div>
    </>
  );
}
