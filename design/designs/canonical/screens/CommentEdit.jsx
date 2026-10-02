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

   THE BODY IS `_shared.jsx`'s `CommentEditBody`, because the acts sheet stands
   on this edit and draws it whole. */
export function Screen() {
  return <CommentEditBody />;
}
