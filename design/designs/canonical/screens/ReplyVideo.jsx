/* The reply composer's VIDEO state (comment video round, 2026-09-02): a
   comment carries up to four pictures OR one video and its cover, never both
   kinds — the post's grammar at comment caps. Entry is unchanged: "+ Add"
   opens the platform's own picker and a video pick lands here, so there is no
   pick stage, and a clip takes no crop; the video uploads at pick.

   The frame is the comment pager's fixed square at comment scale (220px), the
   whole frame fitted inside it — a comment never turns into a post. The video's
   face is `CoverRow`, inlined: the comment composer is one screen, so the cover
   is picked here rather than in a stage of its own.

   THE ROW IS SHOWING BECAUSE IT WAS ASKED FOR (jakob 2026-09-10). This clip is
   vertical, and a vertical clip's default is no cover at either scale: the
   composer opens with no row, the dashed `Add a cover` tile beside the clip
   its one door (round 53, jakob 2026-11-17: no text door under `Cover`),
   which is what `ReplyVideoFailed` draws. This is the state the tile opens —
   and it is also,
   unchanged, what a horizontal or square clip wears from the start. One
   drawing, because there is one row; what differs is whether anyone had to ask
   for it.

   WEB TAKES THIS BOARD 1:1 (jakob 2026-09-02): the file dialog and the
   composer's drop-anywhere path play the picker's part, and nothing else about
   the state differs, so no web board is drawn — the avatar flow's blessing,
   again.

   A VIDEO TAKES ONE DESCRIPTION for the whole clip (jakob 2026-09-02) — the
   same counter row a comment's pictures wear, reading the video instead. The
   cover takes none of its own: it is the video's face, not a second picture.

   THE TILE IS AN AUTHORING TILE, AT THIS SCALE TOO (jakob 2026-09-24): it
   always wears the clip's frame 0.

   THE COVER STANDS BESIDE THE CLIP HERE TOO (round 52 act 3, jakob
   2026-11-17: option (a), "but why would the cover tap not open the cover
   crop here aswell?" — "Yes, both"). Two of the comment's 220 squares do not
   fit the 342 column, so both tiles share it, (342 − 8) ∕ 2 = 167 × 167
   each: the clip, `contain`, and its cover (`CoverTile`) at the comment's
   square, wearing the `Cover` pill. The cover tile is a door, named `Change
   the cover`, as on the edits: the platform's picker, then the cover's crop
   locked to the comment's square (`CoverCrop`, `opener` = reply), back to
   the composer. With no cover the same place holds the dashed `Add a cover`
   door, its words on the tile, the same route once the row stands; for a
   tall clip whose row was not asked for, the dashed tile opens the row
   instead (round 53). The frame row below stays the
   chooser for frames: a tapped frame becomes the cover's tile as it is,
   never cropped. A picture of the author's own stands in the row's picture
   tile's place, outlined (`CoverRow`'s `own`). The `cover` chip draws the
   three: `none` (as the board stood), `frame` (the row's third frame
   chosen) and `own`.

   THE ADD CONTROL IS GONE AND A LINE SAYS WHY (jakob 2026-09-03): "A video is
   the whole comment. Give it a cover below." An absent control explains
   nothing on its own, and the reader who came to add a second thing deserves
   the reason plus what to do next, in the space the control left.

   A SECOND CLIP IS REFUSED, NEVER SWAPPED IN (round 27, seam 252; the post's
   law at comment scale — `ComposePick`'s batch rule). The `batch` chip's `two`
   draws a photos-app batch that held two clips and no picture: the batch's
   first clip is the comment, and the other stands under it refused, `A
   comment carries one video.`, with `Remove it` alone, as every refusal
   (copy-voice, *Refused files*). There is no replace-the-first rule: the
   reader removes the clip they have to put another in its place. */
export const PROPS = {
  batch: { editor: "enum", options: ["one", "two"], default: "one" },
  cover: { editor: "enum", options: ["none", "frame", "own"], default: "none" },
};
export const VALS = `secondShown: this.props.batch === "two" ? "flex" : "none", noneShown: this.props.cover === "none" ? "flex" : "none", frameShown: this.props.cover === "frame" ? "flex" : "none", ownShown: this.props.cover === "own" ? "flex" : "none"`;

const CLIP_FRAMES = [
  { src: "comment-camera.jpg" },
  { src: "comment-camera.jpg", transform: "scale(1.25) translateX(-4%)" },
  { src: "comment-camera.jpg", transform: "scale(1.5)" },
  { src: "comment-camera.jpg", transform: "scale(1.8) translateY(6%)" },
];

export function Screen() {
  return (
    <>
      <WizardHeader title="Reply" leaveLabel="Leave — the reply is discarded" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        {/* The fields scroll under the pinned foot, the edits' reading
            (`EditComposeVideo`): with the refused clip drawn the composer runs
            taller than the phone, and the foot stays where it stands at rest. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          <QuotedRow
            title="The long way home — @ada"
            snippet="The light does something at the third headland that I have never managed…"
            name="Ada Okonkwo"
            src="comment-camera.jpg"
          />

          <WordsBody rows={REPLY_WORDS_ROWS} cap={REPLY_WORDS_CAP} paragraphs={["Eighteen seconds of the same headland, if the light comes through at all."]} />

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <MediaThumb
              src="comment-camera.jpg"
              alt="A person holding a film camera up to the light."
              width={167}
              height={167}
              fit="contain"
              video
              duration="0:18"
              onRemove={() => {}}
              removeLabel="Remove this video"
            />
            <div style={{ display: "{{noneShown}}" }}>
              <CoverTile height={167} />
            </div>
            <div style={{ display: "{{frameShown}}" }}>
              <CoverTile src="comment-camera.jpg" transform="scale(1.5)" width={167} height={167} />
            </div>
            <div style={{ display: "{{ownShown}}" }}>
              <CoverTile src="gallery-market.jpg" transform="scale(1.15)" width={167} height={167} />
            </div>
          </div>

          <div style={{ display: "{{secondShown}}", flexDirection: "column", gap: 10 }}>
            <RefusedFile src="clip-lakeside.jpg" video message="A comment carries one video." />
          </div>

          <QuietNote>A video is the whole comment. Give it a cover below.</QuietNote>

          <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} />

          <div style={{ display: "{{noneShown}}", flexDirection: "column" }}>
            <CoverRow frames={CLIP_FRAMES} />
          </div>
          <div style={{ display: "{{frameShown}}", flexDirection: "column" }}>
            <CoverRow frames={CLIP_FRAMES} selected={2} />
          </div>
          <div style={{ display: "{{ownShown}}", flexDirection: "column" }}>
            <CoverRow frames={CLIP_FRAMES} own={{ src: "gallery-market.jpg", transform: "scale(1.15)" }} />
          </div>

          <div style={{ flex: 1 }} />
        </div>

        <QuietNote>Words first — a video can join them, and it uploads while you write.</QuietNote>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
