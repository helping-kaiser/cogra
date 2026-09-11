/* THE DETAILS STAGE ON THE VIDEO PATH (jakob 2026-09-10, the video-cover
   round). The video path has always ended up on the picture path's details
   board, which draws a gallery a clip post does not have. It has its own now,
   because the ruling put something on it that exists nowhere else: the door.

   A VERTICAL CLIP'S DEFAULT IS NO COVER, so the cover STEP does not stand in
   this path at all — the wizard runs pick → details, and what a cover step
   would have been is one optional row here. jakob's reasons, both of them: an
   autoplaying video that has a cover LOOKS BROKEN, because the cover flashes
   for an instant before playback takes it away; and someone posting nine
   seconds of something vertical must not be marched through a step they were
   always going to skip. SHAPE ALONE DECIDES — never length. A horizontal or
   square clip still meets the frame picker, and arrives here with its face
   already chosen.

   THE DOOR IS A FIELD'S EMPTY STATE, not a shortcut back into a stage. The
   picture path refuses a second entrance to the crop (jakob 2026-08-31,
   "none") and this does not break that rule: for a vertical clip the door is
   the ONLY entrance, because the step it opens was never walked. That is also
   why a clip that came through the cover step shows no door — its face is
   chosen, and the step is one Back away.

   THE CLIP ITSELF IS READ-ONLY HERE. No ×, no manager: a video is the whole
   body, there is nothing to reorder, and the pick step that can take it away
   is one Back away. The description row is the same one pictures wear, reading
   the clip — one entry for the whole thing, never one for the cover. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Details" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Video</FieldLabel>
          <MediaThumb src="clip-lakeside.jpg" alt="" width={54} height={96} video />
          <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Cover</FieldLabel>
          <InlineAction size="sm" selfStart>
            Add a cover
          </InlineAction>
          <QuietNote>It plays the moment it is on screen, so it starts on its own first frame.</QuietNote>
        </div>

        <TextField label="Title" corner="Optional" cap={100} value="Forty seconds of the lake doing nothing" />

        <TextField
          label="Description"
          corner="Optional"
          rows={2}
          cap={500}
          value="Stood there long enough that the midges found me. Worth it for the last ten seconds."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Tags</FieldLabel>
          <InlineAction size="sm" selfStart>+ Add a tag</InlineAction>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>References</FieldLabel>
          <InlineAction size="sm" selfStart>+ Cite something</InlineAction>
        </div>

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
