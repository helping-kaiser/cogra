/* The cover's crop (video conform round, 2026-09-03). A cover chosen from the
   gallery is any shape the gallery holds; the clip is one shape. So the
   gallery path — the cover row's "A picture" tile, at both scales — goes
   through a crop before it comes back to the step that asked for it.

   A FRAME NEEDS NO CROP: it was cut from the clip and already carries the
   clip's shape. Only the picture of your own can disagree with the video, so
   only it is asked to fit.

   THE SHAPE IS LOCKED, like the profile picture's circle (AvatarCrop, whose
   construction this is): the crop viewport wears the video's display shape at
   the scale it will be seen — the clip's own ratio in a post, the comment
   pager's square in a comment. There are no shape chips: choosing a shape
   here would let the cover disagree with the thing it is the face of.

   ONE CROP MODEL (jakob 2026-11-11, seam 301): the frame is FIXED at the
   video's shape and the PICTURE moves (drag) and zooms (pinch, or the zoom
   track) under it.

   THE FRAME ALWAYS HAS THE CLIP'S DIMENSIONS (jakob 2026-11-12: "tall video
   = tall cover, square square and wide wide" — "the crop of the cover must
   always enforce the dimension of the clip"). The frame takes the clip's
   shape as the clip stands in a card (`clipFrame`: its own ratio, a clip
   taller than 4:5 at 4:5), never another, and what the crop exports is that
   shape. The stage is the post crop's, 390 × 488 under every shape (the
   orchestrator's reading, shown to jakob); the frame takes the stage's width
   less the 24 gutters, centred in its height. The `clip` setting draws the
   three: `wide` a 16:9 clip's 342 × 192 at top 148 (the default), `tall` a
   4:5 frame's 342 × 427.5 at top 30.25, `square` 342 × 342 at top 73 — the
   comment's square too. No line says so and no chip offers another shape
   (round 44, the removable-text pass).

   THE ZOOM IS ON SCREEN (the K13 round): `CropZoom` under the stage, its
   thumb at this crop's 1.15× between the fill (1×) and about 4×, on both
   platforms; the focused stage moves the picture with the arrow keys
   (`CropViewport`), 1 % a press, 10 % with Shift (jakob 2026-10-05).

   THE X SAYS WHAT LEAVING KEEPS, BY ENTRANCE (copy-voice, *The wizard's two
   ends*). The board draws the post's entrance, `Leave — your draft is kept`;
   entered from a reply's video it reads `Leave — the reply is discarded`, and
   from a comment edit's or a post edit's `Leave — the edit is discarded` — the X of the flow
   that opened the crop, asking first where that flow's X asks.

   REGISTERED under its own `coverCrop` prefix (seam 248): `header`, the
   `viewport`, the `zoom` slider and `next` — the step every flow that crops
   a cover shares. */
export const NODE = "coverCrop";
export const PROPS = { clip: { editor: "enum", options: ["wide", "tall", "square"], default: "wide" } };
export const VALS = `frameHeight: this.props.clip === "tall" ? "427.5px" : this.props.clip === "square" ? "342px" : "192px"`;
export function Screen() {
  return (
    <>
      <WizardHeader title="The cover" leaveLabel="Leave — your draft is kept" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 16px", overflow: "hidden" }}>
        <CropViewport src="gallery-market.jpg" shape="rect" stageHeight={488} height="{{frameHeight}}" scale={1.15} origin="50% 45%" node="viewport" />
        <CropZoom scale={1.15} node="zoom" />
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }} node="next">Next</Button>
      </div>
    </>
  );
}
