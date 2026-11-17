/* The profile picture's crop (media slice): the one image a profile has —
   circular 1:1, drag and pinch. Reached two ways (jakob 2026-09-01): the
   avatar badge on one's own profile — the standalone shortcut, Next goes to
   the picture's own seal — and Change picture on the edit screen, where Next
   returns to the edit instead: ONE seal covers picture and fields together,
   so nobody pays twice for one profile update.

   ONE CROP MODEL (jakob 2026-11-11, seam 301): the circle is a FIXED frame,
   342 × 342 at top 24 in the 390 × 390 stage (`CropViewport`'s inset 24),
   and the PICTURE moves (drag) and zooms (pinch, or the zoom track) under it;
   outside the circle the picture stays in view, darkened.

   THE ZOOM IS ON SCREEN (the K13 round): `CropZoom` under the circle, its
   thumb at this crop's 1.2× between the fill (1×) and 10×, on both
   platforms; the focused stage moves the picture with the arrow keys
   (`CropViewport`), 1 % a press, 10 % with Shift (jakob 2026-10-05). No line
   says how to move it (round 44, the removable-text pass). */
/* REGISTERED under the `avatarCrop` prefix (round 48, seam 323-11 and 323-6), `CoverCrop`'s names: `header`, `viewport`, `zoom` and `next`. Names only: not a pixel moves. */
/* THE `picked` CHIP (round 50, jakob 2026-11-17, his 9: "should be right when
   you pick it no? so if possible on the pick-stage else in the crop (and
   submit of crop is disabled?)"). No pick stage of CoGra's own exists — the
   device's picker is — so the crop carries the refusal, for both openers.
   A refused file never joins (`ComposePickedErrors`), so nothing stands in
   the circle to move or zoom: the frame stands empty in its place, the
   empty tile's honesty (`RefusedFile`), and the zoom goes with the picture.
   The refusal's line stands where the file was offered — under the circle,
   in the zoom's place — in the refused files' error voice, never a dialog
   or a snackbar (`ReplyMediaErrors`). `Next` stays and dims; the header's
   back arrow is the way out, back to the screen that asked for the picture.
   No `Remove it` and no `Retry`: there is no list to remove the file from,
   and asking again cannot make it fit. */
/* THE `opener` CHIP NAMES THE BACK ARROW BY WHO OPENED THE CROP (jakob
   2026-11-17, C8): `Back to your profile` from the profile head's badge,
   `Back to the edit` from `Change picture` on Edit profile — the arrow
   returns to that screen, so it says which. Nothing else on the crop
   differs between the two. */
export const NODE = "avatarCrop";
export const PROPS = {
  opener: { editor: "enum", options: ["badge", "edit"], default: "badge" },
  picked: { editor: "enum", options: ["fine", "too-big", "gif", "unreadable"], default: "fine" },
};
export const VALS = `backLabel: this.props.opener === "edit" ? "Back to the edit" : "Back to your profile", cropShown: this.props.picked === "fine" ? "flex" : "none", emptyShown: this.props.picked === "fine" ? "none" : "block", tooBigShown: this.props.picked === "too-big" ? "block" : "none", gifShown: this.props.picked === "gif" ? "block" : "none", unreadableShown: this.props.picked === "unreadable" ? "block" : "none", nextOpacity: this.props.picked === "fine" ? "1" : "var(--state-disabled)", nextCursor: this.props.picked === "fine" ? "pointer" : "default"`;

const REFUSAL = {
  margin: 0,
  fontSize: "var(--text-label-small)",
  fontWeight: "var(--text-label-small--font-weight)",
  lineHeight: "var(--text-label-small--line-height)",
  letterSpacing: "var(--text-label-small--letter-spacing)",
  color: "var(--error)",
};
const pickedCopy = (value) => ({ "data-node-chip": "picked", "data-node-key": value });

export function Screen() {
  return (
    <>
      <WizardHeader title="Your picture" backLabel="{{backLabel}}" leaveLabel="Leave" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 16px", overflow: "hidden" }}>
        <div style={{ display: "{{cropShown}}", flexDirection: "column", gap: 12 }}>
          <CropViewport src="comment-camera.jpg" shape="circle" scale={1.2} origin="50% 35%" node="viewport" />
          <CropZoom scale={1.2} node="zoom" />
        </div>
        <div style={{ display: "{{emptyShown}}", flex: "none", width: 390, height: 390, margin: "0 -24px", position: "relative" }}>
          <div aria-hidden="true" style={{ position: "absolute", left: 24, top: 24, width: 342, height: 342, borderRadius: "var(--radius-full)", background: "var(--surface-container-highest)" }} />
        </div>
        <div style={{ display: "{{tooBigShown}}" }} {...pickedCopy("too-big")}>
          <p role="alert" style={REFUSAL} data-node="refusal">That picture is too big — a picture can be up to 10 MB.</p>
        </div>
        <div style={{ display: "{{gifShown}}" }} {...pickedCopy("gif")}>
          <p role="alert" style={REFUSAL} data-node="refusal">That GIF moves, and CoGra can&apos;t take a moving GIF here. A still one is fine.</p>
        </div>
        <div style={{ display: "{{unreadableShown}}" }} {...pickedCopy("unreadable")}>
          <p role="alert" style={REFUSAL} data-node="refusal">That file isn&apos;t a picture CoGra can read.</p>
        </div>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%", opacity: "{{nextOpacity}}", cursor: "{{nextCursor}}" }} node="next">Next</Button>
      </div>
    </>
  );
}
