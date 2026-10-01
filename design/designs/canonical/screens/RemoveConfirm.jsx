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
   own nouns. */
export function Screen() {
  return (
    <>
      <DetailHeader items={OWN_POST_MENU} />
      <DetailColumn>
        <PostCard {...SOL_POST} variant="detail" bundle={mkBundle(0.1, 1)} />
      </DetailColumn>
      <RemoveDialog kind="post" />
    </>
  );
}
