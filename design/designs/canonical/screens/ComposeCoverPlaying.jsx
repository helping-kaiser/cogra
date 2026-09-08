/* THE COVER STEP WITH THE PREVIEW RUNNING (jakob's ruling, the slice-2.5
   round). `ComposeCover` draws the clip at rest — `MediaThumb`'s video state,
   the play disc on its scrim and the duration in the corner. This is what the
   play tap leaves behind.

   IT IS ITS OWN BOARD BECAUSE THE TWO STATES CANNOT BOTH BE TRUE. The video
   conform round ruled that the cover "is the clip's face wherever the clip
   isn't running, and never returns once playback has started" — so a play disc
   and a pause button on one frame would draw a state the product never reaches.
   The canvas already answers this way wherever an interaction has a second
   state worth drawing: `ComposeSealUploading` beside `ComposeSeal`,
   `ComposeUploading` beside `ComposeDetails`, `ReplyVideoFailed` beside
   `ReplyVideo`.

   THE CHROME IS THE POST DETAIL'S, NOT THE WEB ELEMENT'S. `MediaAttachment`'s
   transport rung — the centred play/pause between the two skips, the inset bar
   carrying elapsed · timeline · total, and the sound control riding it. Drawn
   revealed, because a board of the auto-hidden state is a board of a video.

   NO FULLSCREEN TOGGLE. Every other transport offers one because the clip it
   plays is published and the viewer is a real surface. Here the clip is not a
   post yet and there is nowhere for that control to go, so the transport is
   drawn without it rather than with a control the graph cannot wire.

   THE STRIP AND THE FOOT ARE `ComposeCover`'s, unchanged: playing the preview
   is a detour, not a step, so the frame choice and the way forward stay exactly
   where the author left them. */
export function Screen() {
  return (
    <>
      <WizardHeader title="The video's face" stageLabel="Video only" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "16px 24px", overflow: "hidden" }}>
        <MediaAttachment
          src="post-clip.mp4"
          poster="post-photo.jpg"
          alt="The clip being given a face."
          kind="video"
          ratio="square"
          controls="transport"
          fullscreen={false}
          elapsed="0:12"
          duration="0:42"
          progress={0.29}
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
