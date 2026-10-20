/* THE COMMENT'S LICENSE, OVER THE THREAD (readme §13, the menus round). The
   comment's menu carries the same License terms row the post's does and opens
   the same sheet — over the thread, because that is the surface the reader
   asked from.

   IT IS ITS OWN BOARD, AND THAT IS THE POINT. Pointing the comment's row at the
   post's board would answer a question about a comment with a post's terms, on
   a screen the reader is two sheets above. The thread stays where they left it
   and the sheet comes up over it — the same stack `CommentMenu` draws, with the
   answer in place of the menu that asked for it.

   THE STACK IS DRAWN AS LAYERS. The terms sheet is `stacked`, so its wash falls
   between the two and dims the thread, and its surface takes the rung above the
   thread's. The thread's own top — its handle, its title — stays in view over
   the terms, which is what says the reader is still in it.

   TOBIAS'S COMMENT IS PUBLIC DOMAIN: both axes at zero, the one reading readers
   already have a word for, and the word rides the caption while the rows still
   spell what it means. The post's sheet draws the other case, where the two
   axes differ.

   REGISTERED under the `postDetail` prefix (round 11, the license-axis
   registration), as `CommentMenu` registers the menu it stacks: the detail
   beneath is named as `PostDetail` names it, the thread's own sheet stays
   unnamed, and the terms sheet is `licenseSheet` with its `terms` block and
   the block's two `axis` rows. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />
      <LicenseSheet stacked license={{ attribution: 0, provenance: 0 }} node="licenseSheet" />
    </>
  );
}
