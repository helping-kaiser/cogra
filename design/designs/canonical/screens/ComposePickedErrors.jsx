/* The pick step with a batch part refused (comment video round, 2026-09-02;
   the full refusal vocabulary, video conform round 2026-09-03) — the
   post-scale twin of *Reply · files refused*. A post's caps are 10 pictures
   at 10 MiB each, or one video at 100 MiB with a cover at 10 MiB.

   What was accepted is in the tray; what was refused is listed under it, each
   with the reason it broke. A refused file never joined the batch, so it
   cannot appear in the Show all sheet — the refusal lives here, at the step
   that asked for the file, and its only way out is Remove it.

   THE BOARD IS THE STEP'S WHOLE VOCABULARY, drawn at once: a batch big enough
   to break every rule the step has. Ten pictures were kept, which is what
   makes the count refusal and the mixed-kind refusal honest on the same
   screen — the tray is full, so an eleventh picture has nowhere to go and a
   video cannot join a body the pictures already own.

   A FILE IS JUDGED ON ITS OWN BEFORE IT IS JUDGED AGAINST THE BODY (jakob
   2026-09-03): size and format answer first, the grammar second. That is why
   the oversized clip is refused by its cap and the good clip by the
   mixed-kind line — one file, one line, the nearest reason. */
const PICKED = [
  { src: "post-photo.jpg", alt: "The coast road" },
  { src: "gallery-market.jpg", alt: "" },
  { src: "gallery-honey.jpg", alt: "" },
  { src: "gallery-veg.jpg", alt: "" },
  { src: "post-photo.jpg", alt: "" },
  { src: "gallery-market.jpg", alt: "" },
  { src: "gallery-honey.jpg", alt: "" },
];

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <PickPrompt caption="Pick one picture, several, or one video." escapeLabel="Write words instead" />
      <PickTray count={10} onShowAll={() => {}} clip>
        {PICKED.map((item, index) => (
          <MediaThumb key={index} src={item.src} alt={item.alt} onRemove={() => {}} />
        ))}
      </PickTray>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 24px 0" }}>
        <RefusedFile
          src="gallery-honey.jpg"
          message="That picture is too big — a picture can be up to 10 MB."
        />
        <RefusedFile
          src="post-photo.jpg"
          video
          message="That video is too big — a post's video can be up to 100 MB."
        />
        <RefusedFile
          src="gallery-grapes.jpg"
          message="That GIF moves, and CoGra can't take a moving GIF here. A still one is fine."
        />
        <RefusedFile message="That file isn't a picture or a video CoGra can read." />
        <RefusedFile
          src="comment-camera.jpg"
          video
          message="A post carries pictures or one video, not both."
        />
        <RefusedFile
          src="gallery-veg.jpg"
          message="That's more than a post carries — up to ten pictures."
        />
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "12px 24px 16px" }}>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
