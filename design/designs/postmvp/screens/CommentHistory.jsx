/* A COMMENT'S EDIT HISTORY — the post's chronicle, one kind down (jakob's
   rulings 2026-09-22).

   THE PATTERN DOES NOT CHANGE WITH THE KIND, and that is the whole reason this
   board is drawn: a page title, a list of whole versions newest first, the
   current one marked, a removed version keeping its row, the law at the foot.
   What changes is the master the versions are drawn by. A reader who has read
   one chronicle has read them all.

   IT IS A PAGE, NOT A SHEET, although a comment is read inside one. A history
   is a place a reader goes and comes back from, and a third sheet over a sheet
   over a detail is a stack nobody can find their way out of — the thread's own
   ⋮ is the door, and the door opens a page.

   THE VERSIONS CARRY NO OPINION AND NO REPLY. Both act on the comment rather
   than on one of its versions; the affordance row is simply absent, the way a
   post's version card carries none.

   THE TOMBSTONE IS THE POST'S MARK, AT COMMENT SCALE. `CommentCard` carries the
   record's skeleton the way `PostCard` does — the author and the thread
   position survive, the words and pictures give way to `Removed by its author`
   and the dated line — so the removed version reads exactly as a removed post
   version does. The author's register is this same list with its acts joined
   (`CommentHistoryOwn`). Three versions and the law fit the phone: the column
   measures 612px of the 731 it has. */
export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the comment" />
      <CommentChronicle />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
