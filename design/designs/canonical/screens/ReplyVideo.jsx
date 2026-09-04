/* The reply composer's VIDEO state (comment video round, 2026-09-02): a
   comment carries up to four pictures OR one video and its cover, never both
   kinds — the post's grammar at comment caps. Entry is unchanged: "+ Add"
   opens the platform's own picker and a video pick lands here, so there is no
   pick stage and no crop; the video uploads at pick like a comment's
   pictures do.

   The frame is the comment pager's fixed square at comment scale (220px), the
   whole frame fitted inside it — a comment never turns into a post. The video's
   face is `CoverRow`, inlined: the comment composer is one screen, so the cover
   is picked here rather than in a stage of its own.

   WEB TAKES THIS BOARD 1:1 (jakob 2026-09-02): the file dialog and the
   composer's drop-anywhere path play the picker's part, and nothing else about
   the state differs, so no web board is drawn — the avatar flow's blessing,
   again.

   A VIDEO TAKES ONE DESCRIPTION for the whole clip (jakob 2026-09-02) — the
   same counter row a comment's pictures wear, reading the video instead. The
   cover takes none of its own: it is the video's face, not a second picture.

   THE ADD CONTROL IS GONE AND A LINE SAYS WHY (jakob 2026-09-03): "A video is
   the whole comment. Give it a cover below." An absent control explains
   nothing on its own, and the reader who came to add a second thing deserves
   the reason plus what to do next, in the space the control left. */

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
          width={220}
          height={220}
          fit="contain"
          video
          duration="0:18"
          onRemove={() => {}}
          removeLabel="Remove this video"
        />

        <QuietNote>A video is the whole comment. Give it a cover below.</QuietNote>

        <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} />

        <CoverRow frames={CLIP_FRAMES} />

        <div style={{ flex: 1 }} />

        <QuietNote>Words first — a video can join them, and it uploads while you write.</QuietNote>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
