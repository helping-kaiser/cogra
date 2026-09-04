/* The reply composer with part of a batch refused (comment video round,
   2026-09-02; the full refusal vocabulary, video conform round 2026-09-03).
   A comment's caps are 4 pictures at 10 MiB each, or one video at 50 MiB with
   a cover at 10 MiB; a file over its cap, or one nothing here can read, never
   joins the composer.

   The refusal is drawn WHERE THE FILE WAS OFFERED — the media row of the
   composer that asked for it — never in a dialog, never in a snackbar
   (Snackbar confirms what happened; errors sit on the surface they happened
   on). The caps are named only here, at the moment they bite: nothing
   announces them in advance.

   FOUR PICTURES ARE IN, which is what makes the count refusal and the
   mixed-kind refusal honest on the same screen: the tray is full, so a fifth
   picture has nowhere to go and a video cannot join a body the pictures
   already own. The add control still reads its state — "· 4 of 4" — because
   tapping it is exactly how the fifth picture got refused.

   A FILE IS JUDGED ON ITS OWN BEFORE IT IS JUDGED AGAINST THE BODY (jakob
   2026-09-03): size and format answer first, the grammar second. The
   oversized clip is refused by its cap, the good clip by the mixed-kind
   line — one file, one line, the nearest reason. */
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
          I have the whole walk on film somewhere — these four are the ones that survived.
          <Caret />
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" width={58} height={72} fit="contain" onRemove={() => {}} />
          <MediaThumb src="gallery-market.jpg" alt="" width={96} height={72} fit="contain" onRemove={() => {}} />
          <MediaThumb src="gallery-honey.jpg" alt="" width={72} height={72} fit="contain" onRemove={() => {}} />
          <MediaThumb src="gallery-veg.jpg" alt="" width={96} height={72} fit="contain" progress={0.65} />
        </div>

        <DescribeCounter described={0} total={4} onDescribe={() => {}} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <RefusedFile
            src="comment-camera.jpg"
            video
            message="That video is too big — a comment's video can be up to 50 MB."
          />
          <RefusedFile
            src="gallery-grapes.jpg"
            message="That GIF moves, and CoGra can't take a moving GIF here. A still one is fine."
          />
          <RefusedFile message="That file isn't a picture or a video CoGra can read." />
          <RefusedFile
            src="comment-camera.jpg"
            video
            message="A comment carries pictures or one video, not both."
          />
          <RefusedFile
            src="post-photo.jpg"
            message="That's more than a comment carries — up to four pictures."
          />
        </div>

        <Button variant="text" size="sm" selfStart>+ Add pictures · 4 of 4</Button>

        <div style={{ flex: 1 }} />

        <QuietNote>Words first — pictures can join them.</QuietNote>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
