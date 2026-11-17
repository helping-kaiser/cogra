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
   a still-chooser, not a player. It reserves the clip's OWN output format —
   square for this clip, as on `ComposeCover` — because the shape is known even
   when no frame is, and a tile at any other shape would reserve space the post
   will not take.

   NOTHING ELSE MOVES. Next still reaches details, the gallery picture still
   comes back through the cover's crop at the clip's shape, and Back still
   reaches the pick — a failure of the device is not a change to the flow. And
   a post can always go without a cover, so this step never traps anyone: Next
   is live with nothing chosen.

   A PICTURE OF YOUR OWN SHOWS WHERE IT WAS ASKED FOR (round 52, jakob
   2026-11-17, decision 4): the `cover` chip's `own` draws it back from the
   cover's crop — in the picture tile's place, outlined as chosen
   (`CoverRow`'s `own`), and in the preview at the clip's shape, where the
   neutral tile stood. A tap on it opens the picker again. */
export const PROPS = { cover: { editor: "enum", options: ["none", "own"], default: "none" } };
export const VALS = `noneShown: this.props.cover === "own" ? "none" : "flex", ownShown: this.props.cover === "own" ? "flex" : "none"`;

const PREVIEW_WIDTH = 342; // the wizard's 390 less its two 24px gutters
const CLIP_RATIO = 1; // square — the shape this clip posts at

export function Screen() {
  return (
    <>
      <WizardHeader title="The video's face" stageLabel="Video only" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "16px 24px", overflow: "hidden" }}>
        <div style={{ display: "{{noneShown}}", flexDirection: "column", gap: 16 }}>
          <MediaThumb
            width={PREVIEW_WIDTH}
            height={PREVIEW_WIDTH / CLIP_RATIO}
            radius="var(--radius-medium)"
            video
            duration="0:42"
            label="No frame"
          />

          <CoverRow frames={[]} caption="This clip gave no frames" />
        </div>
        <div style={{ display: "{{ownShown}}", flexDirection: "column", gap: 16 }}>
          <MediaThumb
            src="gallery-market.jpg"
            transform="scale(1.15)"
            width={PREVIEW_WIDTH}
            height={PREVIEW_WIDTH / CLIP_RATIO}
            radius="var(--radius-medium)"
            video
            duration="0:42"
          />

          <CoverRow frames={[]} own={{ src: "gallery-market.jpg", transform: "scale(1.15)" }} caption="This clip gave no frames" />
        </div>

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
