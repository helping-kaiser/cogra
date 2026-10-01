/* YOUR COMMENT, REMOVED BY YOU (the comment-removal round, 2026-10-01) — where
   `CommentRemoveConfirm`'s `Remove` puts the reader: the thread they removed it
   from, with the mark in the comment's place. It is the comment scale of the
   post's `Removed`, drawn in a thread because a comment has no surface of its
   own to be removed from.

   NEVER A SILENT DISAPPEARANCE. Comment nodes are never deleted (comment.md §5):
   removal takes the payload, whole-record, and the structural record is the
   visible mark. So @sol's card stands where it stood in the order, under its
   author and its time, with `Removed by its author` where its words were — the
   same mark a removed post wears, its second line naming the comment.

   THE BRANCH UNDER IT IS THE PROOF. Two replies hang from the removed comment,
   and both stay, under their parent and readable: removal never breaks a
   thread, and a reader arriving at the replies can see what they answered was
   removed by its author rather than lost.

   THE THREAD IS `_shared.jsx`'s, EXTENDED AND NOT FORKED (`ReplySettled`'s
   rule): the sheet learned `removed`, and nothing here re-draws a comment. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet removed scrolledBy={REMOVED_COMMENT_SCROLL} />
    </>
  );
}
