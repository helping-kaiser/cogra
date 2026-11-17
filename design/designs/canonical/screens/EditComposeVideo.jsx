/* Edit a post whose body is a clip (video conform round, 2026-09-03) — the
   EditCompose anatomy with the video and its cover where the picked row was.

   Same contract as the comment scale (CommentEditVideo): the cover is
   changeable, the clip is not. A new cover is a new picture the author
   uploads, and the attachment's cover pointer swaps at the edit's signing — a
   layer on the attachment, never an alteration of the video (api-spec.md).
   Frames are not offered again, because extraction needs a source file the
   device may no longer hold; the gallery is the one way in, through the
   cover's crop (CoverCrop).

   THE DOOR KEYS ON CHOSEN, NOT ON A STILL EXISTING (jakob 2026-09-10, the
   no-cover ruling; read with the stored first frame, readme §13). Since the
   stored-still ruling every clip carries a still — this vertical clip's is
   its taken frame 1 — but a taken still is not a cover anyone picked, and
   chosen-vs-taken is a STORED AUTHORING FACT the edit reads, never a guess
   from bytes. So the cover's tile is a door rather than a picture: "Add a
   cover", where a clip whose face was chosen wears it and is named "Change
   the cover" (the `upload` chip's `uploading` draws that half).
   An edit must never present a cover row presuming a choice exists — the
   field would then show a face nobody picked as if someone had, and every
   path out of it would be a change to something unset. The door is the
   unchosen state of the same field, and what it opens is the same gallery,
   through the same crop.

   The clip's own move is to leave whole. A post that loses its clip is a post
   with words, the same way a post that loses its pictures is — the body
   changes, the post does not become another one. That sentence used to end at
   itself; since the edit body round (2026-09-10) it lands somewhere, and the
   somewhere is `EditWords`, drawn. The × is the whole of this board's share of
   the flip: a clip is never swapped for another clip, and there is no add
   control to offer, so the quiet line stands where one would.

   A NEW COVER GATES THE SIGN ON ITS UPLOAD (jakob 2026-10-05, the 134
   residue's 3b) — the seal's grammar unchanged (`ComposeSealUploading`; said
   in full in `EditCompose`'s docblock). While the cover the edit set is still
   going up, `UploadStatusLine` stands over the foot naming it — `Uploading 0
   of 1 — signing waits for the cover.` (`media="cover"`, the noun blessed
   2026-10-05) — and `Sign the edit` stays enabled; pressed, it reads
   `Signing the edit…` until the bytes land, a failed upload drops the held
   press, and the slow line counts from the press. The `upload` chip draws it:
   the cover's tile then holds the chosen face, named `Change the cover`, and
   the foot's count holds: A NEW FACE
   RIDES THE EDIT RECORD (seam 248, the contract's `coverMediaId` on the
   edit), so it stages the Edit record when nothing has yet, and adds nothing
   when the edit's record is already staged, as here.

   THE COVER STANDS BESIDE THE CLIP, AT THE COVER'S SHAPE (round 52, jakob
   2026-11-17, decision 4; the shape since round 50, impl's seam 342). This
   clip is tall, and a tall clip's cover is cut at 4:5 (`CoverCrop`, jakob
   2026-11-12 and 2026-11-13, N7), so the cover's tile (`CoverTile`) stands
   76.8 × 96 beside the clip's own 54 × 96: the same height, the cover's
   shape. With no cover ever chosen it is the dashed `Add a cover` door;
   with one, the face wearing the `Cover` pill, the tile itself the door
   named `Change the cover`. Either opens the device's picker, then the
   cover's crop.

   REGISTERED under the `postEdit` prefix (seam 248), `EditComposeBody`'s
   names; the clip's block is `video`, its tile `thumb` and the cover's tile
   beside it `cover`, one per `upload` chip value, and the count's two
   readings are the `upload` chip's copies of `acts`.
   THE `signing` CHIP DRAWS THE EDIT CLOSED ON (round 37, jakob 2026-11-11:
   Close on every edit). From the press on `Sign the edit` the act is done:
   past 200ms the commit reads `Signing the edit…`, and the header's X —
   named `Close` from the press — and its arrow close the edit while it goes
   on; the edited card carries the wait and the answer (`SigningAfterClose`). */
export const NODE = "postEdit";
export const PROPS = {
  upload: { editor: "enum", options: ["none", "uploading"], default: "none" },
  signing: { editor: "enum", options: ["none", "signing"], default: "none" },
};
export const VALS = `signRestShown: this.props.signing === "signing" ? "none" : "block", signBusyShown: this.props.signing === "signing" ? "block" : "none", doorShown: this.props.upload === "uploading" ? "none" : "flex", coverShown: this.props.upload === "uploading" ? "flex" : "none", gateShown: this.props.upload === "uploading" ? "flex" : "none", restShown: this.props.upload === "uploading" ? "none" : "flex"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="Edit post" leaveLabel="Leave — the edit is discarded" help="Editing" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        {/* The fields scroll under the pinned foot, the post edit's reading:
            with a chosen cover and the gate drawn, the form runs taller than
            the phone, and the foot stays whole. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-node="video">
            <FieldLabel node="label">Video</FieldLabel>
            {/* THE COVER STANDS BESIDE THE CLIP (round 52, `CoverTile`): the
                clip tile's 96 high, a tall clip's cover at 4:5, 76.8 × 96 —
                the dashed `Add a cover` door while no cover was ever chosen,
                the chosen face once one is, the tile its door. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MediaThumb src="clip-lakeside.jpg" alt="" width={54} height={96} fit="cover" video onRemove={() => {}} removeLabel="Remove this video" node="thumb" />
              <div style={{ display: "{{doorShown}}" }} {...chipCopy("upload", "none")}>
                <CoverTile width={76.8} height={96} node="cover" />
              </div>
              <div style={{ display: "{{coverShown}}" }} {...chipCopy("upload", "uploading")}>
                <CoverTile src="post-photo.jpg" width={76.8} height={96} node="cover" />
              </div>
            </div>
            <DescribeCounter subject="video" described={1} total={1} onDescribe={() => {}} node="describeRow" />
            {/* Where the picture edit's "+ Add" stands, a clip gets the quiet
                line instead (copy-voice, *Staging a video*): there is nothing
                to add to a body one clip already fills. The staging line's
                second half — "Its cover comes next" — is the wizard's, and is
                dropped here because the cover is on this screen, above. */}
            <QuietNote node="rule">A video is the whole post.</QuietNote>
          </div>

          <TextField label="Title" corner="Optional" cap={100} value="The long way home" node="title" />
          <TextField label="Description" corner="Optional" rows={2} cap={500} value="Took the coast road instead of the tunnel. Four hours longer, worth every minute." node="description" />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-node="tags">
            <FieldLabel node="label">Tags</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TopicRemovable topic="coastroad" onEdit={() => {}} node="tag" />
            </div>
            <InlineAction size="sm" selfStart node="add">+ Add a tag</InlineAction>
            {/* The post's other tag, withdrawn in this edit — read back with its
                Undo, as the picture edit reads its own (`WithdrawnLine`). */}
            <WithdrawnLine name="#photography" node="withdrawn" />
          </div>

          {/* AN EDIT OF A CLIP POST TAKES CITATIONS LIKE ANY EDIT (seam 248):
              the References block `CommentEditVideo` draws at comment scale,
              here with nothing standing yet — its add opens the picker. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-node="references">
            <FieldLabel node="label">References</FieldLabel>
            <InlineAction size="sm" selfStart node="add">+ Cite something</InlineAction>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }} data-node="facts">
            <LockedLicenseRow />
            <EditBackingRow />
            <FactRow label="Sensitive" value="Not marked" action="Mark" last node="sensitive" />
          </div>

          <div style={{ flex: 1 }} />
        </div>

        <div style={{ display: "{{gateShown}}", flexDirection: "column" }}>
          <UploadStatusLine done={0} total={1} media="cover" node="gate" />
        </div>
        <div style={{ display: "{{restShown}}", flexDirection: "column" }} {...chipCopy("upload", "none")}>
          <ActsFooter count={4} node="acts" />
        </div>
        <div style={{ display: "{{gateShown}}", flexDirection: "column" }} {...chipCopy("upload", "uploading")}>
          <ActsFooter count={4} node="acts" />
        </div>
        <div style={{ display: "{{signRestShown}}" }}>
          <Button style={{ width: "100%" }} node="sign">Sign the edit</Button>
        </div>
        <div style={{ display: "{{signBusyShown}}" }}>
          <Button style={{ width: "100%" }} busy busyLabel="Signing the edit…">Sign the edit</Button>
        </div>
      </div>
    </>
  );
}
