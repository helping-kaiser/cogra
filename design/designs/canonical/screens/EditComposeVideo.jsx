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
   from bytes. So the row is a door rather than a picture: "Add a cover",
   where a clip whose face was chosen wears it and "Change the cover"
   (CommentEditVideo draws that half, the same contract at the other scale).
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
   of 1 — signing waits for the cover.` (`media="cover"`, the noun new and
   flagged for blessing) — and `Sign the edit` stays enabled; pressed, it reads
   `Signing the edit…` until the bytes land, a failed upload drops the held
   press, and the slow line counts from the press. The `upload` chip draws it:
   the cover row then holds the chosen face and `Change the cover`, the field's
   other half (`CommentEditVideo`), and the foot counts the new face's one
   record (`Cover changed`, `EditActs`). */
export const PROPS = { upload: { editor: "enum", options: ["none", "uploading"], default: "none" } };
export const VALS = `doorShown: this.props.upload === "uploading" ? "none" : "flex", coverShown: this.props.upload === "uploading" ? "flex" : "none", gateShown: this.props.upload === "uploading" ? "flex" : "none", restShown: this.props.upload === "uploading" ? "none" : "flex"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="Edit post" leaveLabel="Leave — your draft is kept" help="Editing" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        {/* The fields scroll under the pinned foot, the post edit's reading:
            with a chosen cover and the gate drawn, the form runs taller than
            the phone, and the foot stays whole. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>Video</FieldLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MediaThumb src="clip-lakeside.jpg" alt="" width={54} height={96} fit="cover" video onRemove={() => {}} removeLabel="Remove this video" />
            </div>
            <DescribeCounter subject="video" described={1} total={1} onDescribe={() => {}} />
            {/* Where the picture edit's "+ Add" stands, a clip gets the quiet
                line instead (copy-voice, *Staging a video*): there is nothing
                to add to a body one clip already fills. The staging line's
                second half — "Its cover comes next" — is the wizard's, and is
                dropped here because the cover is on this screen, above. */}
            <QuietNote>A video is the whole post.</QuietNote>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>Cover</FieldLabel>
            <div style={{ display: "{{doorShown}}", flexDirection: "column", gap: 6 }}>
              <InlineAction size="sm" selfStart>
                Add a cover
              </InlineAction>
              <QuietNote>It plays the moment it is on screen, so it starts on its own first frame.</QuietNote>
            </div>
            <div style={{ display: "{{coverShown}}", alignItems: "center", gap: 8 }}>
              <MediaThumb src="post-photo.jpg" alt="" width={54} height={96} fit="cover" />
              <Button variant="text" size="sm">Change the cover</Button>
            </div>
          </div>

          <TextField label="Title" corner="Optional" cap={100} value="The long way home" />
          <TextField label="Description" corner="Optional" rows={2} cap={500} value="Took the coast road instead of the tunnel. Four hours longer, worth every minute." />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>Tags</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TopicRemovable topic="coastroad" onEdit={() => {}} />
            </div>
            <InlineAction size="sm" selfStart>+ Add a tag</InlineAction>
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
        </div>

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
