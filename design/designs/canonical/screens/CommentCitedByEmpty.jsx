/* THE COMMENT'S SIDE OF THE CITED-BY SHEET, IN ITS EMPTY STATE (the topic
   round, 2026-09-14) — `CommentOpinionsEmpty`'s twin, and drawn for the same
   two reasons.

   ONE BOARD, TWO THINGS CHECKED. The comment path's sheet is two sheets deep —
   the menu closes, the sheet comes up over the thread, and the thread is still
   there under the wash — which is the `CommentLicense` arrangement exactly. And
   this is where the empty state is reachable at all: a post's count line drops
   away at zero (`SettingsHidden`'s rule — a tap that can only open an empty
   list is a tap spent on nothing), while a menu row stands whatever the count
   is, so the comment's door is the one a reader can walk through and find
   nothing behind it.

   The populated rows are drawn on `CitedBy`; nothing about them changes here
   but what the title names, and a comment's sheet is titled the same "Cited by"
   — the surface the reader tapped from says what "this" is, and a title that
   repeated it would be the only place in the product that did.

   THE LINE MIRRORS `CommentOpinionsEmpty`'s, which is the product's own empty
   voice: calm, and naming the one thing that would fill it. It never scolds and
   it carries no `error` colour — a comment nobody has cited is not a fault, and
   nothing is owed. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />

      <BottomSheet open stacked ariaLabel="Cited by" maxHeight="62%">
        <SheetTitle>Cited by</SheetTitle>
        <div style={{ padding: "0 24px 8px" }}>
          <EmptyState title="Nothing cites this yet — yours would be the first." />
        </div>
      </BottomSheet>
    </>
  );
}
