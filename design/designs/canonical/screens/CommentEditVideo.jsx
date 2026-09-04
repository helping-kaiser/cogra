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

   NO "a video is the whole comment" LINE HERE. That line exists to explain an
   add control that went missing; the edit surface has labelled fields instead,
   and Video sitting above Cover says the shape of the body without a sentence.

   The words, topics, citations and the license row are unchanged from
   CommentEdit: one screen, one batch, the license locked. */

export function Screen() {
  return (
    <>
      <WizardHeader title="Edit comment" leaveLabel="Leave — the edit is discarded" action={<SystemHelpDot ariaLabel="Editing" />} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Your comment on "The long way home".
        </p>

        <TextField label="Words" rows={2} value="Eighteen seconds of the same headland, if the light comes through at all." />

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
          <FieldLabel>Topics</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, padding: "4px 12px", borderRadius: "var(--radius-full)", background: "var(--secondary-container)", color: "var(--on-secondary-container)", fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", letterSpacing: "var(--text-label-large--letter-spacing)" }}>
              #glovebox
              <Icon name="close" size={16} />
            </span>
            <Button variant="outline" size="sm">Add a topic</Button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>References</FieldLabel>
          <Button variant="text" size="sm" selfStart>+ Cite something</Button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, borderTop: "1px solid var(--border-hairline)" }}>
            <span style={{ flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>License</span>
            <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>Public domain</span>
            <span style={{ color: "var(--text-secondary)", display: "inline-flex" }} aria-label="The license never changes">
              <Icon name="lock" size={16} />
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, borderTop: "1px solid var(--border-hairline)", borderBottom: "1px solid var(--border-hairline)" }}>
            <span style={{ flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>Sensitive</span>
            <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>Not marked</span>
            <Button variant="text" size="sm">Mark</Button>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          This creates 2 signed actions
          <span style={{ display: "inline-flex" }}>
            <Icon name="expand_more" size={16} />
          </span>
        </div>
        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>
    </>
  );
}
