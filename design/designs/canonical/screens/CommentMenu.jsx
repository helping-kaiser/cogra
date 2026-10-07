/* THE COMMENT'S MENU, OVER THE THREAD (readme §13, the menus round). A comment
   wears the same overflow a post does — the standing ruling that comments and
   posts carry one vocabulary — so the sheet holds the same rows, pointed at the
   comment instead of the post.

   A COMMENT IS SAVEABLE LIKE ANYTHING ELSE (jakob, the private-viewer-state
   round), and it lands in the one mixed Saved list beside posts and people.
   The row carries the state, as it does on a post: `Unsave` once it is kept.

   NO HIDE ROW HERE, AND THE ABSENCE IS RULED (jakob 2026-09-12: "he clicks the
   profile of the commenter and hides from there"). Hiding is an act on an
   ACTOR, and the route to it is the commenter's own profile — their chip is one
   tap away and its ⋮ carries the row. A thread of many voices is not where that
   decision belongs. The post menu keeps its own for the opposite reason: a post
   IS its author's act, and a feed of them is what a reader asking to be rid of
   someone is looking at.

   IT IS DRAWN STACKED ON PURPOSE. The thread already lives in a sheet, so this
   menu is a sheet on a sheet, and that is the state the reader is actually in:
   the menu at the thumb, the thread dimmed behind it and still there. Drawn
   flat it would be indistinguishable from the post's menu, and the one thing
   worth checking here — that a second sheet over the first still reads — would
   go unchecked.

   The menu is `stacked`, so its wash falls between the two layers and its
   surface takes the rung above the thread's. The thread keeps its top edge, its
   handle and its Comments title in view over the menu.

   REGISTERED under the `postDetail` prefix (design ⇄ impl seam 086): the thread
   is the post's detail with its sheet raised, and a menu belongs to the surface
   that hosts it. The detail beneath is named as `PostDetail` names it, the menu
   is `menuSheet` with one name per row, as every menu's; the thread's own sheet
   stays unnamed until a board registers it. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />

      <BottomSheet open stacked ariaLabel="Comment actions" node="menuSheet">
        {COMMENT_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}
