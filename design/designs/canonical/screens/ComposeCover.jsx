/* THE VIDEO'S FACE (legacy conversion, the conformance round): the stage the
   video path takes where the picture path takes the crop. A clip needs one
   still to stand for it everywhere it is not playing, and this is where that
   still is chosen.

   THE PREVIEW IS `MediaThumb`'s VIDEO STATE at post scale — the play disc on
   its scrim and the duration on the trailing corner are that component's
   anatomy, drawn once for the tray's 114×64 tile and once here, and the disc
   sizes itself to the frame it lands in.

   AND ITS SHAPE IS THE CLIP'S OUTPUT FORMAT (jakob 2026-09-11), never a square
   specimen: what the author is shown here is the shape the post will stand at.
   This clip is square — `ComposeCoverPlaying` plays the same one — so the
   preview is the wizard's content width by the same again. A 16:9 clip's would
   be 342 × 192; a vertical clip never reaches this step, because its default is
   no cover at all.

   THE STRIP IS `CoverRow`, whole: the "Cover" label, the four frames cut from
   the clip, the dashed way out to the gallery, and the line underneath. The
   comment composer and the reply's failed-video board draw the same row, and a
   fourth spelling of it here is the drift the round exists to end. */
const PREVIEW_WIDTH = 342; // the wizard's 390 less its two 24px gutters
const CLIP_RATIO = 1; // square — the shape this clip posts at

export function Screen() {
  return (
    <>
      <WizardHeader title="The video's face" stageLabel="Video only" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "16px 24px", overflow: "hidden" }}>
        <MediaThumb
          src="post-photo.jpg"
          width={PREVIEW_WIDTH}
          height={PREVIEW_WIDTH / CLIP_RATIO}
          radius="var(--radius-medium)"
          video
          duration="0:42"
        />

        <CoverRow
          frames={[
            { src: "post-photo.jpg" },
            { src: "post-photo.jpg", transform: "scale(1.25) translateX(-4%)" },
            { src: "post-photo.jpg", transform: "scale(1.5)" },
            { src: "post-photo.jpg", transform: "scale(1.8) translateY(6%)" },
          ]}
        />

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
