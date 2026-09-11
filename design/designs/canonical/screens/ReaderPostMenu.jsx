/* SOMEONE ELSE'S POST, ITS MENU OPEN (readme §13, the menus round). The one
   overflow every reader's card and detail view has carried since the canvas was
   wired — the sheet the ⋮ opens on fifteen surfaces, mastered once here rather
   than redrawn beside each of them.

   FOUR ROWS, IN THE ORDER A READER REACHES FOR THEM. Save, the thing done most;
   citing, the reader's way of making this post the subject of their own; hiding
   its author, rare and the only row that takes something away; and the license
   terms, which every genesis record declares and a reuser has to be able to
   check — the rarest read in the product, so it closes the sheet. Report is the
   one function still missing, and it waits for the slice that answers it.

   SAVE CARRIES THE STATE NOTHING ELSE SHOWS (jakob). The affordance row stays
   opinion · score · comments · share — no saved mark anywhere on the card — so
   this row is where a reader learns whether the post is kept. Saved, it reads
   `Unsave` — one word (jakob 2026-09-11): a control says what will happen (§3),
   which is why the saved form is a verb rather than the word Saved, and one
   verb is what the Saved list's own icon-only control is already labelled.

   HIDING IS CONFIRM-FREE AND NAMES ITS PERSON. `Hide @ada`, never "Hide this
   author" — the handle is the thing a reader recognises, and the word they will
   look for again under Hidden accounts in settings. The rows go and a snackbar
   offers Undo; a dialog for a comfort a reader can reverse in one tap would be
   a ceremony around nothing.

   The license row closes this sheet and raises the terms over the surface the
   reader asked from — `PostLicense`, a drawer they drop by the scrim, the swipe
   or Escape. The terms are never a state of the card. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="Post actions">
        {READER_POST_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} />
        ))}
      </BottomSheet>
    </>
  );
}
