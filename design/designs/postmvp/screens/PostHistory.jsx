/* THE EDIT HISTORY OF A POST, as anybody meets it (jakob's rulings
   2026-09-22, would-like #2).

   ONE LIST OF WHOLE VERSIONS, NEWEST FIRST, AND NEVER A DIFF. The store keeps
   complete states and L1 signs a full new record for every edit, so a
   difference between two versions is something a reader works out by reading.
   Computing one would also be a claim about which change mattered — the
   author's business, not the product's.

   IT IS PUBLIC, INCLUDING TO A SIGNED-OUT GUEST. Every version is a public
   record the moment it is signed; a gate on reading one would be a gate on
   reading the post. The gates in this product are on ACTING, and there is
   nothing to act on here.

   THE CURRENT VERSION IS IN THE LIST, MARKED, rather than standing above it.
   It is a version like the others — the newest one — and lifting it out would
   make the page read as "the post, and some old copies", which is the belief
   the round exists to correct.

   THE TOMBSTONED VERSION KEEPS ITS ROW. Removal takes the payload and never
   the record, so the mark stands where the words were, dated, in the position
   the version has always had. A row that vanished would be the one thing this
   page cannot do: erase silently.

   NO ACT OF ANY KIND IS DRAWN HERE. The author's register is the same list
   with its own acts joined (`PostHistoryOwn`); a reader's copy carries none,
   so the page is a reading surface whole.

   THE FRAME IS TALLER THAN A PHONE, deliberately: a chronicle is a scrolling
   page, and a board cut at 844 would show two versions and hide both the third
   and the law at its foot — the two things a reviewer is here to check. */
export const FRAME = { width: 390, height: 880 };

export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the post" />
      <PostChronicle />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
