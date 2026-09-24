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
   control to offer, so the quiet line stands where one would. */

export function Screen() {
  return (
    <>
      <WizardHeader title="Edit post" leaveLabel="Leave — your draft is kept" help="Editing" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
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
          <InlineAction size="sm" selfStart>
            Add a cover
          </InlineAction>
          <QuietNote>It plays the moment it is on screen, so it starts on its own first frame.</QuietNote>
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

        <ActsFooter count={3} />
        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>
    </>
  );
}
