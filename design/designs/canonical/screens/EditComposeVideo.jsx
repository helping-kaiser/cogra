/* Edit a post whose body is a clip (video conform round, 2026-09-03) — the
   EditCompose anatomy with the video and its cover where the picked row was.

   Same contract as the comment scale (CommentEditVideo): the cover is
   changeable, the clip is not. A new cover is a new picture the author
   uploads, and the attachment's cover pointer swaps at the edit's signing — a
   layer on the attachment, never an alteration of the video (api-spec.md).
   Frames are not offered again, because extraction needs a source file the
   device may no longer hold; the gallery is the one way in, through the
   cover's crop (CoverCrop).

   The clip's own move is to leave whole. A post that loses its clip is a post
   with words, the same way a post that loses its pictures is — the body
   changes, the post does not become another one. */

export function Screen() {
  return (
    <>
      <WizardHeader title="Edit post" leaveLabel="Leave — your draft is kept" help="Editing" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Video</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MediaThumb src="post-photo.jpg" alt="" width={96} height={54} fit="cover" video onRemove={() => {}} removeLabel="Remove this video" />
          </div>
          <DescribeCounter subject="video" described={1} total={1} onDescribe={() => {}} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Cover</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MediaThumb src="post-photo.jpg" alt="" width={96} height={54} fit="cover" />
            <Button variant="text" size="sm">Change the cover</Button>
          </div>
        </div>

        <TextField label="Title" corner="Optional" value="The long way home" />
        <TextField label="Description" corner="Optional" rows={2} value="Took the coast road instead of the tunnel. Four hours longer, worth every minute." />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Topics</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TopicRemovable topic="coastroad" />
            <Button variant="outline" size="sm">Add a topic</Button>
          </div>
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
          <FactRow label="Sensitive" value="Not marked" action={<Button variant="text" size="sm">Mark</Button>} last />
        </div>

        <div style={{ flex: 1 }} />

        <ActsFooter count={3} />
        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>
    </>
  );
}
