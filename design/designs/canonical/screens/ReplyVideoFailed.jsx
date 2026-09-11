/* The clip that didn't upload (video conform round, 2026-09-03).

   A FAILED UPLOAD IS NOT A REFUSED FILE. A refusal is an answer — the file is
   too big, or nothing here reads it — and retrying cannot change it, so the
   refusal row drops Retry and offers only Remove it. A failed upload is a
   fault: the file was fine and the network wasn't. Faults get Retry, the way
   every other transport fault in the product does, and `UploadErrorLine`
   already carries both ways out. Shipping a clip failure with the refusal's
   no-Retry form told the author the file was wrong when it wasn't.

   The tile wears MediaThumb's failed badge and dims; the words and the ways
   out sit beside the row rather than inside 220px of preview. The × is gone
   from the tile — Remove it is in the line, so the two removals never sit two
   pixels apart meaning the same thing. The footer's "it uploads while you
   write" is gone with the upload it described: the error line is the state
   now, and a second sentence about uploading would contradict it.

   THE WAY TO A COVER STAYS, and here it is the DOOR (jakob 2026-09-10). This
   clip is vertical, and a vertical clip's default is no cover at any scale —
   there is no step to skip in a one-screen composer, so what gives way is the
   row: "Add a cover" stands where the strip would, and the strip is what it
   opens (`ReplyVideo` draws that state, the same clip with its row showing).

   The failure changes nothing about that. Frames are cut from the file on the
   device, so they exist whether or not the bytes ever reached CoGra, and the
   cover is a separate upload of a separate asset — choosing one while the clip
   retries is not wasted work. What the door protects against is the opposite
   mistake: a strip demanding a decision from someone whose upload just failed,
   about a picture their clip does not need. */

export function Screen() {
  return (
    <>
      <WizardHeader title="Reply" leaveLabel="Leave — the reply is discarded" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuotedRow
          title="The long way home — @ada"
          snippet="The light does something at the third headland that I have never managed…"
          name="Ada Okonkwo"
          src="ava1.jpg"
        />

        <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)" }}>
          Eighteen seconds of the same headland, if the light comes through at all.
          <Caret />
        </p>

        <MediaThumb
          src="comment-camera.jpg"
          alt="A person holding a film camera up to the light."
          width={200}
          height={200}
          fit="contain"
          video
          failed
        />

        <UploadErrorLine message="That video didn't upload." onRetry={() => {}} onRemove={() => {}} />

        <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FieldLabel>Cover</FieldLabel>
          <InlineAction size="sm" selfStart>
            Add a cover
          </InlineAction>
          <QuietNote>It plays the moment it is on screen, so it starts on its own first frame.</QuietNote>
        </div>

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
