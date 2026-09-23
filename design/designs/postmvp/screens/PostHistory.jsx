/* THE EDIT HISTORY OF A POST, as anybody meets it (jakob's rulings
   2026-09-22, would-like #2; the canvas review 2026-09-23).

   ONE LIST OF WHOLE VERSIONS, NEWEST FIRST, AND NEVER A DIFF. The store keeps
   complete states and L1 signs a full new record for every edit, so a
   difference between two versions is something a reader works out by reading.
   Computing one would also be a claim about which change mattered — the
   author's business, not the product's.

   A VERSION IS THE CONTENT STATE AND NOTHING ELSE. Title, description, body,
   media and the sensitive mark — what `post_versions` keeps. Adding or removing
   a tag or a reference is NOT an edit (jakob: "they are standalone edges
   pointing to it, they are just baked into the edit screen in UI"), so no
   version here differs from another by a tag, and every card wears the same
   tags line: the post's current tags, a fact about the post.

   ANY KIND OF POST, ONE CHRONICLE. A body is words xor media per version, so a
   post can change kind between two of them — the 5 September version was a
   picture, rewritten as words three days later. It is drawn by the same master
   at the same variant as its neighbours; a change of kind is one more version,
   never a different sort of row.

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
   page, and a board cut at 844 would hide the versions and the law at its foot
   — the things a reviewer is here to check. The column measures 1369px whole
   (four versions, one of them a square picture, and the footnote); with the
   48px header and the 65px bar that is 1482, drawn at 1488. */
export const FRAME = { width: 390, height: 1488 };

export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the post" />
      <PostChronicle />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
