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
   the face in the cover row is the new one, and the foot's count holds: A
   NEW FACE RIDES THE EDIT RECORD (seam 248, the contract's `coverMediaId` on
   the edit), staging the Edit record when nothing has yet and adding nothing
   when it is already staged, as here.

   REGISTERED under the `commentEdit` prefix (seam 248), `CommentEditBody`'s
   names; the clip's block is `video`, the cover's `cover`, and the count's
   two readings are the `upload` chip's copies of `acts`. 
   THE `signing` CHIP DRAWS THE EDIT CLOSED ON (round 37, jakob 2026-11-11:
   Close on every edit). From the press on `Sign the edit` the act is done:
   past 200ms the commit reads `Signing the edit…`, and the header's X —
   named `Close` from the press — and its arrow close the edit while it goes
   on; the edited card carries the wait and the answer (`SigningAfterClose`). */
/* THE `clip` CHIP DRAWS A CLIP PICKED IN THE EDIT (round 44, seam 295-3, the
   lane's option a): a words comment's edit takes a video, words alone read on
   the edit's own state (`CommentEdit.md`). `kept` is the comment's own clip,
   as above. `picked` is a clip just picked: it uploads at once, wearing its
   ring (`EditCompose`'s), the cover row is the door `Add a cover` with no
   picture (this board's own law for a clip with no cover; the door is
   `EditComposeVideo`'s), and the gate names it, `Uploading 0 of 1 — signing
   waits for the video.` (`UploadStatusLine`'s `media="video"`, the reply's
   and the composer's gate). `failed` is that clip's upload failing: the tile
   marked, `That video didn't upload.` with `Retry · Remove it` under it
   (`ReplyVideoFailed`'s line), the gate's fault reading `The video didn't
   upload. Signing waits for it.` (`ReplySealUploadFailed`) and `Sign the
   edit` disabled (`EditCompose`'s `upload` = failed). `second` is a second
   clip picked while the first uploads: refused, never swapped in, `A comment
   carries one video.` with `Remove it` alone (`ReplyVideo`'s `batch` = two).
   A picked clip rides the edit's own record, as a new face does, so the
   footer's count holds.

   `picked-cover` is a picked clip and a new cover uploading TOGETHER (jakob
   2026-11-12, question 2, as recommended): the clip with its ring, the cover
   row holding the chosen picture with its own ring and `Change the cover`,
   and the gate naming what is still uploading in the two lines that exist —
   first `Uploading 0 of 2 — signing waits for the video.`, then, the clip
   landed, `Uploading 1 of 2 — signing waits for the cover.` The board draws
   the first. No note stands under the cover row. */
export const NODE = "commentEdit";
export const PROPS = {
  clip: { editor: "enum", options: ["kept", "picked", "picked-cover", "failed", "second"], default: "kept" },
  upload: { editor: "enum", options: ["none", "uploading"], default: "none" },
  signing: { editor: "enum", options: ["none", "signing"], default: "none" },
};
export const VALS = `keptShown: this.props.clip === "kept" ? "flex" : "none", pickedShown: this.props.clip === "picked" ? "flex" : "none", bothShown: this.props.clip === "picked-cover" ? "flex" : "none", failedShown: this.props.clip === "failed" ? "flex" : "none", secondShown: this.props.clip === "second" ? "flex" : "none", doorShown: this.props.clip === "kept" || this.props.clip === "picked-cover" ? "none" : "flex", signRestShown: this.props.signing === "signing" || this.props.clip === "failed" ? "none" : "block", signBusyShown: this.props.signing === "signing" && this.props.clip !== "failed" ? "block" : "none", signFailedShown: this.props.clip === "failed" ? "block" : "none", gateShown: this.props.clip === "kept" && this.props.upload === "uploading" ? "flex" : "none", restShown: this.props.clip === "kept" && this.props.upload === "uploading" ? "none" : "flex"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="Edit comment" leaveLabel="Leave — the edit is discarded" help="Editing" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        {/* The fields scroll under the pinned foot, the post edit's reading
            (`EditComposeVideo`): with the gate drawn the form runs taller
            than the phone, and the foot stays where it stands at rest. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
          <QuietNote node="target">Your comment on "The long way home".</QuietNote>

          <TextField label="Words" rows={2} cap={2000} value="Eighteen seconds of the same headland, if the light comes through at all." node="words" />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-node="video">
            <FieldLabel node="label">Video</FieldLabel>
            <div style={{ display: "{{keptShown}}", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" size={56} fit="contain" video onRemove={() => {}} removeLabel="Remove this video" node="thumb" />
              </div>
              <DescribeCounter subject="video" described={1} total={1} onDescribe={() => {}} node="describeRow" />
            </div>
            <div style={{ display: "{{pickedShown}}", flexDirection: "column", gap: 6 }} {...chipCopy("clip", "picked")}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MediaThumb src="clip-lakeside.jpg" alt="" size={56} fit="contain" video progress={0.55} onRemove={() => {}} removeLabel="Remove this video" node="thumb" />
              </div>
              <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} node="describeRow" />
            </div>
            <div style={{ display: "{{bothShown}}", flexDirection: "column", gap: 6 }} {...chipCopy("clip", "picked-cover")}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MediaThumb src="clip-lakeside.jpg" alt="" size={56} fit="contain" video progress={0.55} onRemove={() => {}} removeLabel="Remove this video" node="thumb" />
              </div>
              <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} node="describeRow" />
            </div>
            <div style={{ display: "{{failedShown}}", flexDirection: "column", gap: 6 }} {...chipCopy("clip", "failed")}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MediaThumb src="clip-lakeside.jpg" alt="" size={56} fit="contain" video failed node="thumb" />
              </div>
              <UploadErrorLine message="That video didn't upload." onRetry={() => {}} onRemove={() => {}} node="uploadError" />
              <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} node="describeRow" />
            </div>
            <div style={{ display: "{{secondShown}}", flexDirection: "column", gap: 6 }} {...chipCopy("clip", "second")}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MediaThumb src="clip-lakeside.jpg" alt="" size={56} fit="contain" video progress={0.55} onRemove={() => {}} removeLabel="Remove this video" node="thumb" />
              </div>
              <RefusedFile src="comment-camera.jpg" video message="A comment carries one video." />
              <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} node="describeRow" />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-node="cover">
            <FieldLabel node="label">Cover</FieldLabel>
            <div style={{ display: "{{keptShown}}", alignItems: "center", gap: 8 }}>
              <MediaThumb src="comment-camera.jpg" alt="" size={56} fit="contain" node="thumb" />
              <Button variant="text" size="sm" node="change">Change the cover</Button>
            </div>
            {/* A cover set beside the picked clip, uploading with its own ring. */}
            <div style={{ display: "{{bothShown}}", alignItems: "center", gap: 8 }} {...chipCopy("clip", "picked-cover")}>
              <MediaThumb src="comment-camera.jpg" alt="" size={56} fit="contain" progress={0.3} node="thumb" />
              <Button variant="text" size="sm" node="change">Change the cover</Button>
            </div>
            {/* A picked clip has no face yet: the door, `EditComposeVideo`'s. */}
            <div style={{ display: "{{doorShown}}", flexDirection: "column" }}>
              <InlineAction size="sm" selfStart node="add">
                Add a cover
              </InlineAction>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-node="tags">
            <FieldLabel node="label">Tags</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TopicRemovable topic="glovebox" onEdit={() => {}} node="tag" />
            </div>
            <InlineAction size="sm" selfStart node="add">+ Add a tag</InlineAction>
            {/* The tag withdrawn in this edit, read back with its Undo, as
                `CommentEdit` reads its own (`WithdrawnLine`). */}
            <WithdrawnLine name="#coastroad" node="withdrawn" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-node="references">
            <FieldLabel node="label">References</FieldLabel>
            <InlineAction size="sm" selfStart node="add">+ Cite something</InlineAction>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }} data-node="facts">
            <LockedLicenseRow />
            <FactRow label="Sensitive" value="Not marked" action="Mark" last node="sensitive" />
          </div>

          <div style={{ flex: 1 }} />
        </div>

        <div style={{ display: "{{gateShown}}", flexDirection: "column" }}>
          <UploadStatusLine done={0} total={1} media="cover" node="gate" />
        </div>
        <div style={{ display: "{{pickedShown}}", flexDirection: "column" }} {...chipCopy("clip", "picked")}>
          <UploadStatusLine done={0} total={1} media="video" node="gate" />
        </div>
        <div style={{ display: "{{bothShown}}", flexDirection: "column" }} {...chipCopy("clip", "picked-cover")}>
          <UploadStatusLine done={0} total={2} media="video" node="gate" />
        </div>
        <div style={{ display: "{{secondShown}}", flexDirection: "column" }} {...chipCopy("clip", "second")}>
          <UploadStatusLine done={0} total={1} media="video" node="gate" />
        </div>
        <div style={{ display: "{{failedShown}}", flexDirection: "column" }} {...chipCopy("clip", "failed")}>
          <UploadStatusLine failed message="The video didn't upload." onRetry={() => {}} node="gate" />
        </div>
        <div style={{ display: "{{restShown}}", flexDirection: "column" }} {...chipCopy("upload", "none")}>
          <ActsFooter count={3} node="acts" />
        </div>
        <div style={{ display: "{{gateShown}}", flexDirection: "column" }} {...chipCopy("upload", "uploading")}>
          <ActsFooter count={3} node="acts" />
        </div>
        <div style={{ display: "{{signRestShown}}" }}>
          <Button style={{ width: "100%" }} node="sign">Sign the edit</Button>
        </div>
        <div style={{ display: "{{signBusyShown}}" }}>
          <Button style={{ width: "100%" }} busy busyLabel="Signing the edit…">Sign the edit</Button>
        </div>
        <div style={{ display: "{{signFailedShown}}" }} {...chipCopy("clip", "failed")}>
          <Button style={{ width: "100%" }} disabled node="sign">Sign the edit</Button>
        </div>
      </div>
    </>
  );
}
