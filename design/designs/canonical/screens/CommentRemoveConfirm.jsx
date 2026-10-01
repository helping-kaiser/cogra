/* REMOVE THIS COMMENT? — the think-twice dialog behind your own comment's
   `Remove` (the comment-removal round, 2026-10-01).

   THE POST'S CONFIRM WITH THE NOUNS SWAPPED (`RemoveDialog`, the confirm-nouns
   rule): the same title shape, the same two sentences, the same pair — the safe
   answer filled, `Remove` a text button in no colour. The one change the kind
   makes is where the mark keeps its place: a comment has one spot, in its own
   thread, where a post's place stands in threads (copy-voice, the whole-comment
   confirm).

   THE SURFACE BENEATH IS THE THREAD, whole and inert: the menu has closed, and
   the dialog comes up over the sheet the reader asked from — lifted above it
   the way `ReplyKeyAbsent`'s notice is. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />
      <RemoveDialog kind="comment" overSheet />
    </>
  );
}
