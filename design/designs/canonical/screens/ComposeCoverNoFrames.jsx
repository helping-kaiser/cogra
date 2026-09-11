/* WHEN THE CLIP GIVES NO FRAMES (jakob 2026-09-10, the video-cover round).
   Frame extraction is a thing a device does, and a thing a device can fail at
   — a codec it will not decode, a file it can read but not seek. The cover
   step answers by shrinking to the one path that still works.

   THE STRIP IS GONE, NOT BLANK. `CoverRow` hands back only its way out to the
   gallery when it is given no frames, and the line under it says why the
   choice is smaller than it was. Four empty tiles would offer four pictures
   that do not exist, and an unexplained single tile would read as a step that
   lost its point.

   THE PREVIEW IS THE NEUTRAL TILE. With no frame there is no still to show,
   and the rule against inventing imagery is not suspended by an error: the
   tile reserves its space and says what belongs there. The duration stays,
   because the clip's length is known either way; the play disc does not,
   because a control drawn on an empty tile is chrome, and the preview here is
   a still-chooser, not a player.

   NOTHING ELSE MOVES. Next still reaches details, the gallery picture still
   comes back through the cover's crop at the clip's shape, and Back still
   reaches the pick — a failure of the device is not a change to the flow. And
   a post can always go without a cover, so this step never traps anyone: Next
   is live with nothing chosen. */
export function Screen() {
  return (
    <>
      <WizardHeader title="The video's face" stageLabel="Video only" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "16px 24px", overflow: "hidden" }}>
        <MediaThumb
          width={342}
          height={342}
          radius="var(--radius-medium)"
          video
          duration="0:42"
          label="No frame"
        />

        <CoverRow frames={[]} caption="This clip gave no frames — choose a picture of your own, or leave it without one." />

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
