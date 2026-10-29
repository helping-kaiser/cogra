/* Remove — the think-twice dialog. The SAFE action is the filled one.

   AND `Remove` CARRIES NO COLOUR (jakob 2026-09-15: "probabely non
   destructive? a removal is not an error no?"). §11's rule needs no exception
   here: the error role is for something that went wrong, and a reader removing
   their own post is doing exactly what they meant to. What makes this dialog
   careful is the emphasis — the safe action filled, the removal a text button
   — and the two sentences above it, not a red word. `SeveranceConfirm` and
   `RejectConfirm` were already drawn this way.

   THE DIALOG IS `_shared.jsx`'s `RemoveDialog`, the post's kind of it: the
   comment's confirm (`CommentRemoveConfirm`) draws the same anatomy with its
   own nouns.

   THE `answer` CHIP DRAWS THE REMOVAL THAT DID NOT GO THROUGH (seam 248; the
   chip's name is `SeveranceConfirm`'s). `asking` is the dialog as raised;
   `failed` is the same dialog after a removal that got no answer — still up,
   `That didn't send. Try again.` in its `line` slot above the pair, `Remove`
   reading `Retry`. The post beneath is not removed.

   REGISTERED under the `postDetail` prefix (seam 248), named as `RemoveMenu`
   is beneath, the dialog `dialog` as every confirm names it. */
export const NODE = "postDetail";
export const PROPS = { answer: { editor: "enum", options: ["asking", "failed"], default: "asking" } };
export const VALS = `askingShown: this.props.answer === "failed" ? "none" : "block", failedShown: this.props.answer === "failed" ? "block" : "none"`;
export function Screen() {
  return (
    <>
      <DetailHeader items={OWN_POST_MENU} node="header" />
      <DetailColumn>
        <PostCard {...SOL_POST} variant="detail" bundle={mkBundle(0.1, 1)} node="card" />
      </DetailColumn>
      <div style={{ display: "{{askingShown}}" }} data-node-chip="answer" data-node-key="asking">
        <RemoveDialog kind="post" node="dialog" />
      </div>
      <div style={{ display: "{{failedShown}}" }} data-node-chip="answer" data-node-key="failed">
        <RemoveDialog kind="post" failed node="dialog" />
      </div>
    </>
  );
}
