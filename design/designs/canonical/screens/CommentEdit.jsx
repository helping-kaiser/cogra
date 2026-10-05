/* Edit comment (media slice): the post's one-screen-one-batch, scaled to the
   comment's anatomy — words, pictures (uncropped, four max, described via the
   same counter line the reply composer wears), tags, citations, the license
   locked. Entered from Edit on an own comment. The acts footer is the
   affordance into the acts sheet (the CommentEditActs board — the EditActs
   pattern at comment scale).

   IT CARRIES THE POST EDIT'S WITHDRAWAL PACKAGE UNCHANGED (backlog 126, jakob
   2026-10-02: "same semantics at comment scale"). The comment's standing
   citations are rows that open `RefPairEdit`, where `Remove citation` says its
   cost inline; a tag or citation withdrawn reads back as a `Withdrawn:` line
   with its `Undo`; a tag's withdrawal is one record and a citation's its
   `withdrawalCost` counter-records; Sign is the confirmation.

   THE TWO CASES THE POST EDIT DRAWS, AT COMMENT SCALE (jakob 2026-10-05, the
   134 residue's 3a and 3b; `EditCompose`'s docblock says them in full). A
   standing citation whose target was removed wears `KeptPicksReview`'s
   removed-mark face, its pair and controls kept (the `target` chip). An edit
   that took new pictures gates `Sign the edit` on their upload in the seal's
   grammar — enabled at rest, `Signing the edit…` once pressed, the held press
   dropped by a failed upload, the slow line counted from the press (the
   `upload` chip draws the running gate: the comment's one picture came in
   this edit, and the gate's noun counts, `Uploading 0 of 1 — signing waits
   for the picture.` — jakob 2026-10-05, the 136 round's 5b).

   THE 136 ROUND'S TWO, AT COMMENT SCALE (jakob 2026-10-05; `EditCompose`
   draws both). Past 5s of signing, `ActsFooter`'s slow subline stands under
   the count. A failed upload marks its tile and puts `One picture didn't
   upload.` with `Retry · Remove it` under the pictures, beside the gate's
   fault reading and the disabled Sign; `Remove it` un-gates Sign.

   THE BODY IS `_shared.jsx`'s `CommentEditBody`, because the acts sheet stands
   on this edit and draws it whole. */
export const PROPS = {
  target: { editor: "enum", options: ["live", "removed"], default: "live" },
  upload: { editor: "enum", options: ["none", "uploading"], default: "none" },
};
export const VALS = `liveShown: this.props.target === "removed" ? "none" : "block", removedShown: this.props.target === "removed" ? "block" : "none", gateShown: this.props.upload === "uploading" ? "block" : "none"`;

export function Screen() {
  return <CommentEditBody holes />;
}
