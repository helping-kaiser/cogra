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

   THE CLIP CARRIES ITS OWN ×, AND NO MANAGER (jakob's ruling 2026-09-15). A
   video is the whole body, so there is nothing to reorder and no set for a
   Show all sheet to open on — one clip is not a set. But a picture can be
   taken out of the post from this stage, through the row that opens the
   manager, and a clip has to be too: what an author most wants to revise here
   is WHICH clip, and a stage that will not take the pick back sends them
   hunting a Back arrow to undo it. So the tile wears the × the pick step's
   tray already draws on this same clip — one gesture for one item, in the one
   place the clip is drawn — and taking it away gives back the step that takes
   picks, where another can be chosen.

   The description row is the same one pictures wear, reading the clip — one
   entry for the whole thing, never one for the cover.

   THE SKIPPED STEP STILL TAKES FRAME 1 (jakob 2026-09-23, the feed-video
   rulings). Skipping the cover step skips the CHOICE, not the still: the
   device silently extracts the clip's first frame and uploads it as the
   stored face, using the frame picker's own extraction. Reading surfaces are
   always handed a still, so a coverless clip never shows an empty box while
   video data loads — and no flash can come of it, because a frame-1 still IS
   the frame playback starts on. When extraction fails, the post ships without
   a still and the neutral tile stands (Cover · no frames came back). */
export function Screen() {
  return (
    <>
      <WizardHeader title="Details" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Video</FieldLabel>
          <MediaThumb src="clip-lakeside.jpg" alt="" width={54} height={96} video onRemove={() => {}} removeLabel="Remove this video" />
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
