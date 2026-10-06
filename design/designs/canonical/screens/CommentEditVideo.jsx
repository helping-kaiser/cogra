/* Edit a comment whose body is a clip (video conform round, 2026-09-03) — the
   CommentEdit anatomy with the video where the picture tray was.

   THE COVER CAN CHANGE AFTER PUBLISHING; the clip cannot be swapped. Changing
   the cover is a new picture the author uploads and the attachment points at
   from the edit's own signing — a new layer, never an alteration of the video
   (api-spec.md). Swapping the clip itself would make the edit a different
   comment wearing the old one's history, so the clip's only move here is to
   leave whole, taking the comment's media with it.

   FRAMES ARE NOT RE-OFFERED (jakob 2026-09-03). Extraction needs the source
   file, and by edit time the file has often left the device — offering four
   tiles that may all fail to fill is worse than not offering them. So the
   change affordance is the gallery alone, and the picture it brings back goes
   through the cover's crop (CoverCrop) before it lands here again.

   THIS COMMENT HAS A COVER, so the row shows the face and the way to change it.
   That is a choice its author made — a vertical clip's default is no cover
   (jakob 2026-09-10), and one that has one had the door opened. The other half
   of the same field is `EditComposeVideo`'s: a clip without a cover shows "Add
   a cover" and no picture, because an edit must never present a row presuming
   something the post does not have. One contract, one field, two states, drawn
   once each across the two scales.

   NO "a video is the whole comment" LINE HERE. That line exists to explain an
   add control that went missing; the edit surface has labelled fields instead,
   and Video sitting above Cover says the shape of the body without a sentence.

   The words, tags, citations and the license row are unchanged from
   CommentEdit: one screen, one batch, the license locked.

   A NEW COVER GATES THE SIGN ON ITS UPLOAD (jakob 2026-10-05, the 134
   residue's 3b) — the seal's grammar unchanged (`ReplySealUploading`; said in
   full in `EditCompose`'s docblock). While the cover the edit set is still
   going up, `UploadStatusLine` stands over the foot naming it — `Uploading 0
   of 1 — signing waits for the cover.` (`media="cover"`, the noun blessed
   2026-10-05) — and `Sign the edit` stays enabled; pressed, it reads
   `Signing the edit…` until the bytes land, a failed upload drops the held
   press, and the slow line counts from the press. The `upload` chip draws it:
   the face in the cover row is the new one, and the foot counts its one
   record (`Cover changed`, `CommentEditActs`). */
export const PROPS = { upload: { editor: "enum", options: ["none", "uploading"], default: "none" } };
export const VALS = `gateShown: this.props.upload === "uploading" ? "flex" : "none", restShown: this.props.upload === "uploading" ? "none" : "flex"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="Edit comment" leaveLabel="Leave — the edit is discarded" help="Editing" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <QuietNote>Your comment on "The long way home".</QuietNote>

        <TextField label="Words" rows={2} cap={2000} value="Eighteen seconds of the same headland, if the light comes through at all." />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Video</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" size={56} fit="contain" video onRemove={() => {}} removeLabel="Remove this video" />
          </div>
          <DescribeCounter subject="video" described={1} total={1} onDescribe={() => {}} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Cover</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MediaThumb src="comment-camera.jpg" alt="" size={56} fit="contain" />
            <Button variant="text" size="sm">Change the cover</Button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Tags</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TopicRemovable topic="glovebox" onEdit={() => {}} />
          </div>
          <InlineAction size="sm" selfStart>+ Add a tag</InlineAction>
          {/* The tag withdrawn in this edit, read back with its Undo, as
              `CommentEdit` reads its own (`WithdrawnLine`). */}
          <WithdrawnLine name="#coastroad" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>References</FieldLabel>
          <InlineAction size="sm" selfStart>+ Cite something</InlineAction>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow
            label="License"
            value="Public domain"
            action={
              <span style={{ color: "var(--text-secondary)", display: "inline-flex" }} aria-label="The license never changes">
                <Icon name="lock" size={16} />
              </span>
            }
          />
          <FactRow label="Sensitive" value="Not marked" action="Mark" last />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "{{gateShown}}", flexDirection: "column" }}>
          <UploadStatusLine done={0} total={1} media="cover" />
        </div>
        <div style={{ display: "{{restShown}}", flexDirection: "column" }}>
          <ActsFooter count={3} />
        </div>
        <div style={{ display: "{{gateShown}}", flexDirection: "column" }}>
          <ActsFooter count={4} />
        </div>
        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>
    </>
  );
}
