/* THE COMMENT'S MENU, OVER THE THREAD (readme §13, the menus round). A comment
   wears the same overflow a post does — the standing ruling that comments and
   posts carry one vocabulary — so the sheet holds the same rows, pointed at the
   comment instead of the post.

   A COMMENT IS SAVEABLE LIKE ANYTHING ELSE (jakob, the private-viewer-state
   round), and it lands in the one mixed Saved list beside posts and people.
   The row carries the state, as it does on a post: `Remove from saved` once it
   is kept.

   NO HIDE ROW HERE. Hiding is about a person, and the two places a reader meets
   one are their profile and the post that brought them — a thread of many
   voices is not where that decision belongs. The comment's author is a tap away
   on their chip, and the row waits there.

   IT IS DRAWN STACKED ON PURPOSE. The thread already lives in a sheet, so this
   menu is a sheet on a sheet, and that is the state the reader is actually in:
   the menu at the thumb, the thread dimmed behind it and still there. Drawn
   flat it would be indistinguishable from the post's menu, and the one thing
   worth checking here — that a second sheet over the first still reads — would
   go unchecked.

   The menu is `stacked`, so its wash falls between the two layers and its
   surface takes the rung above the thread's. The thread keeps its top edge, its
   handle and its Comments title in view over the menu. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />

      <BottomSheet open stacked ariaLabel="Comment actions">
        {COMMENT_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} />
        ))}
      </BottomSheet>
    </>
  );
}
