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

   THE COVER STANDS BESIDE THE CLIP, ALWAYS (round 52, jakob 2026-11-17,
   decision 4: "this way we also have a entrance gate for changing the
   cover"). The clip's 54 × 96 tile has a second tile beside it at the same
   96 high and the cover's own shape — `CoverTile`. This board's clip is
   vertical, so it skipped the step and the same place holds the dashed `Add
   a cover` door at a tall clip's 4:5, 76.8 × 96 — the default, as the board
   stood. Once a cover is chosen through that door, the tile shows it,
   wearing the `Cover` pill, at the same 4:5, 76.8 × 96 (a tall clip's cover
   is cut at 4:5, `CoverCrop`), and it is the door back into the step, named
   `Change the cover`; the `cover` chip's `chosen` draws it. A square clip's
   cover would stand 96 × 96, a wide one's 170.7 × 96. Either door opens the
   cover step, and its Next comes back here with the choice.

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
export const PROPS = { cover: { editor: "enum", options: ["none", "chosen"], default: "none" } };
export const VALS = `noneShown: this.props.cover === "chosen" ? "none" : "flex", chosenShown: this.props.cover === "chosen" ? "flex" : "none"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="Details" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Video</FieldLabel>
          <div style={{ display: "{{noneShown}}", alignItems: "center", gap: 8 }}>
            <MediaThumb src="clip-lakeside.jpg" alt="" width={54} height={96} video onRemove={() => {}} removeLabel="Remove this video" />
            <CoverTile width={76.8} height={96} />
          </div>
          <div style={{ display: "{{chosenShown}}", alignItems: "center", gap: 8 }}>
            <MediaThumb src="clip-lakeside.jpg" alt="" width={54} height={96} video onRemove={() => {}} removeLabel="Remove this video" />
            <CoverTile src="clip-lakeside.jpg" transform="scale(1.5)" width={76.8} height={96} />
          </div>
          <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} />
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
