/* THE COMMENT'S CROP (round 52, jakob 2026-11-17, his hand test's W2 and the
   decision 2 that answered it: "ofcourse all media should be square in
   comments but why is there no crop step for images?"). A comment's pictures
   are square — the comment scale's one shape — so the pictures a reply or a
   comment edit takes pass through this step after the platform's picker
   (the browser's file dialog, or a drop, on the web) and before they join
   the composer's tray. What the author frames here is what the comment
   shows, and what the viewer shows: only the cropped exports leave the
   device, and their upload starts at this step's `Next` — the post crop's
   rule (`ComposeCrop`).

   IT IS TWO CROPS' PARTS, NOTHING NEW. The stage and the frame are the cover
   crop's square (`CoverCrop`'s `clip` = square, "the comment's square"):
   `CropViewport` on the 390 × 488 stage, the frame 342 × 342 at 73, fixed,
   the picture moving and zooming under it, the zoom from the fill to 10×.
   The strip is the post crop's (`ComposeCrop`): `MediaThumb`s at 48, the
   framed picture outlined, the rest at 65 %, each picture keeping its own
   framing. No shape chips and no line under the zoom: the shape is the
   comment's and nobody chooses it, so `One shape for the whole post.` has
   nothing to say here.

   ONE PICTURE, NO STRIP. The `pictures` chip draws a single pick: the strip
   is there to move between pictures, and with one there is nowhere to move.

   THE `opener` CHIP NAMES THE TWO WAYS IN (jakob 2026-11-17, C8): from the
   reply composer the arrow is `Back a step` and the X `Leave — the reply is
   discarded`; from a comment edit — its `+ Add pictures`, or its `Crop the
   pictures` door (round 53) — the arrow is `Back to the edit` and the X `Leave —
   the edit is discarded` — the X of the flow
   that opened the crop, asking first where that flow's X asks.

   REGISTERED under its own `replyCrop` prefix, `CoverCrop`'s names and
   `ComposeCrop`'s strip: `header`, `viewport`, `zoom`, the `pictures`
   strip with one `thumb` per picture keyed by its place, and `next`. */
export const NODE = "replyCrop";
export const PROPS = {
  opener: { editor: "enum", options: ["reply", "edit"], default: "reply" },
  pictures: { editor: "enum", options: ["two", "one"], default: "two" },
};
/* ON A COMMENT'S EDIT THE STRIP HOLDS EVERY PICTURE OF THE COMMENT (round 53,
   jakob 2026-11-17, "Yes, same" — the post edit's option C at the comment's
   scale). At `edit` with `two`, the comment's own picture (the one
   `CommentEdit` holds) and the one just added from `+ Add pictures`, in the
   edit's order, the new one selected first and on the stage; at `edit` with
   `one`, the comment's one picture opened from the edit's `Crop the
   pictures` door (round 53 act 2), no strip. A
   picture the comment already holds is framed within its published square,
   tighter and never wider; one whose framing changed is a replacement in the
   signed edit, riding the edit's own record as an added picture does. The
   square frame, the zoom and no shape row are the same at both openers. The
   new picture's stage is drawn unregistered beside the registered
   `viewport`, which is hidden, never left out, so its path stands. */
export const VALS = `backLabel: this.props.opener === "edit" ? "Back to the edit" : "Back a step", leaveLabel: this.props.opener === "edit" ? "Leave — the edit is discarded" : "Leave — the reply is discarded", stripShown: this.props.pictures === "one" ? "none" : "flex", stageFirstShown: this.props.opener === "edit" && this.props.pictures === "two" ? "none" : "contents", stageNewShown: this.props.opener === "edit" && this.props.pictures === "two" ? "contents" : "none", thumb1Outline: this.props.opener === "edit" ? "none" : "2px solid var(--primary)", thumb1Opacity: this.props.opener === "edit" ? "0.65" : "1", thumb2Outline: this.props.opener === "edit" ? "2px solid var(--primary)" : "none", thumb2Opacity: this.props.opener === "edit" ? "1" : "0.65"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="Crop" backLabel="{{backLabel}}" leaveLabel="{{leaveLabel}}" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 16px", overflow: "hidden" }}>
        <div style={{ display: "{{stageFirstShown}}" }}>
          <CropViewport src="comment-camera.jpg" shape="rect" stageHeight={488} height={342} scale={1.15} origin="50% 40%" node="viewport" />
        </div>
        <div style={{ display: "{{stageNewShown}}" }}>
          <CropViewport src="gallery-market.jpg" shape="rect" stageHeight={488} height={342} scale={1.15} origin="50% 40%" />
        </div>
        <CropZoom scale={1.15} node="zoom" />

        <div style={{ display: "{{stripShown}}", gap: 8, alignItems: "center" }} data-node="pictures">
          <span style={{ display: "inline-flex", flex: "none", borderRadius: "var(--radius-small)", outline: "{{thumb1Outline}}", outlineOffset: 1, opacity: "{{thumb1Opacity}}" }}>
            <MediaThumb src="comment-camera.jpg" node="thumb" nodeKey="1" />
          </span>
          <span style={{ display: "inline-flex", flex: "none", borderRadius: "var(--radius-small)", outline: "{{thumb2Outline}}", outlineOffset: 1, opacity: "{{thumb2Opacity}}" }}>
            <MediaThumb src="gallery-market.jpg" node="thumb" nodeKey="2" />
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }} node="next">Next</Button>
      </div>
    </>
  );
}
