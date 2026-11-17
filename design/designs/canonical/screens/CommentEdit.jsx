/* Edit comment (media slice): the post's one-screen-one-batch, scaled to the
   comment's anatomy — words, pictures (squares, four max, a new one framed
   in the comment's crop `ReplyCrop` on its way in, described via the
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

   A WORDS COMMENT'S EDIT TAKES A VIDEO (backlog 148's reading (a), jakob
   2026-11-10: "all comments can hold words/images/one video. there is no
   specific 'text-comment'"). The family's: a comment holding words alone
   reads its add row `+ Add pictures or a video`, as the reply's composer
   does, and a picked clip arrives as `CommentEditVideo`'s `clip` setting
   draws it, with its cover row (round 44, seam 295). Words alone is read on
   the edit's own state: a comment whose pictures this edit removed may take
   a clip. This board draws a comment holding a
   picture, so its row keeps `+ Add pictures · 1 of 4`; the `body` chip's
   `words` draws the comment holding words alone (round 30, jakob 2026-11-11:
   "draw it"): its media block is the add row alone, `+ Add pictures or a
   video`, as the reply composer's words stage draws it.

   THE PICTURES ARE RE-CROPPED BY A TEXT DOOR (round 53 act 2, jakob
   2026-11-17, B1 = (b)): `Crop the pictures` directly above `Describe the
   pictures`, in that door's pattern and by its rule — the same words for one
   picture as for four, no door on a words comment — opening `ReplyCrop` with
   every picture of the comment in the strip. The thumbnails keep their ×
   alone.

   THE BODY IS `_shared.jsx`'s `CommentEditBody`, because the acts sheet stands
   on this edit and draws it whole.

   REGISTERED under the `commentEdit` prefix (seam 248), `CommentEditBody`'s
   names. 
   THE `signing` CHIP DRAWS THE EDIT CLOSED ON (round 37, jakob 2026-11-11:
   Close on every edit). From the press on `Sign the edit` the act is done:
   past 200ms the commit reads `Signing the edit…`, and the header's X —
   named `Close` from the press — and its arrow close the edit while it goes
   on; the edited card carries the wait and the answer (`SigningAfterClose`). */
/* THE `tag` CHIP (round 50, jakob 2026-11-17, his 19): `refused` stages a
   second tag, `#saltmaps`, picked in this edit, and draws the server's answer
   at Sign that it did not land — `This tag didn't land.` with `Remove it`
   under the chips, the chip ringed in the error ink, `Sign the edit` standing
   (`editTagRefusedLine`). With one tag on the row the ring would say nothing
   the line does not. */
export const NODE = "commentEdit";
export const PROPS = {
  target: { editor: "enum", options: ["live", "removed"], default: "live" },
  /* `recrop-failed` (round 53 act 2, jakob 2026-11-17, B2 = (b)): the
     comment's own picture, re-framed in its square crop, did not upload —
     its tile marked, `Retry · Undo` under the pictures, `Undo` dropping the
     re-crop alone; the gate's fault reading and `Sign the edit` disabled, as
     the post edit's `failed`. */
  upload: { editor: "enum", options: ["none", "uploading", "recrop-failed"], default: "none" },
  body: { editor: "enum", options: ["pictures", "words"], default: "pictures" },
  signing: { editor: "enum", options: ["none", "signing"], default: "none" },
  /* THE `post` CHIP draws the line when the comment's post was removed
     (jakob 2026-11-17): `Your comment on @ada's removed post.` */
  post: { editor: "enum", options: ["live", "removed"], default: "live" },
  tag: { editor: "enum", options: ["landed", "refused"], default: "landed" },
  /* THE `fault` CHIP (round 51, jakob 2026-11-17, impl 348): the signing
     failed while the edit stood open — `unsent` (no answer) or `refused`
     (an answered refusal) — its line in `Sign the edit`'s place with an
     outlined `Retry` under it, the count kept above (`editFault`). */
  fault: { editor: "enum", options: ["none", "unsent", "refused"], default: "none" },
};
export const VALS = `signRestShown: this.props.signing === "signing" || this.props.fault !== "none" || this.props.upload === "recrop-failed" ? "none" : "block", signBusyShown: this.props.signing === "signing" && this.props.fault === "none" && this.props.upload !== "recrop-failed" ? "block" : "none", signRecropShown: this.props.upload === "recrop-failed" && this.props.fault === "none" ? "block" : "none", thumbRestShown: this.props.upload === "recrop-failed" ? "none" : "contents", thumbRecropShown: this.props.upload === "recrop-failed" ? "block" : "none", faultUnsentShown: this.props.fault === "unsent" ? "flex" : "none", faultRefusedShown: this.props.fault === "refused" ? "flex" : "none", liveShown: this.props.target === "removed" ? "none" : "block", removedShown: this.props.target === "removed" ? "block" : "none", gateShown: this.props.upload === "uploading" && this.props.fault === "none" ? "block" : "none", picturesShown: this.props.body === "words" ? "none" : "flex", addLabel: this.props.body === "words" ? "+ Add pictures or a video" : "+ Add pictures · 1 of 4", postLiveShown: this.props.post === "removed" ? "none" : "block", postRemovedShown: this.props.post === "removed" ? "block" : "none", tagRing: this.props.tag === "refused" ? "1px solid var(--error)" : "none", tagRefusedShown: this.props.tag === "refused" ? "block" : "none", tagSecondShown: this.props.tag === "refused" ? "inline-flex" : "none"`;

export function Screen() {
  return <CommentEditBody holes bodyChip />;
}
