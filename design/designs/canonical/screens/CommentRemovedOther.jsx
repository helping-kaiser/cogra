/* COMMENTS · ANOTHER'S COMMENT, REMOVED BY ITS AUTHOR (round 57, backlog 223;
   jakob 2026-11-18, C2 (a)). The thread as a reader meets it once @tobias
   removed his comment: the card stands where it stood in the order, under
   its author and its time, `Removed by its author` and the removal's date
   where its words were, and its two replies — @ada's and @mira's — unfolded
   under the mark and readable (`CommentRemoved.md`: a removed comment's
   replies stay under it). It is `CommentRemoved`'s state on someone else's
   comment, as `RemovedOther` is `Removed`'s: the state the record brings, not
   a different tap.

   THE THREAD IS `_shared.jsx`'s, its `removedOther`; nothing here re-draws a
   comment. Its ⋮ keeps the reader's comment menu whole
   (`CommentRemovedOtherMenu` draws it open).

   REGISTERED under the `postDetail` prefix, the mark
   `threadSheet.commentCard.removalMark` under @tobias's key, as
   `CommentRemoved` names @sol's. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet removedOther node="threadSheet" />
    </>
  );
}
