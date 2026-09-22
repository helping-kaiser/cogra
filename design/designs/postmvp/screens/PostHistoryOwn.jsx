/* THE AUTHOR'S REGISTER — the same chronicle every reader sees, with the two
   acts only its author has (jakob's rulings 2026-09-22).

   IT IS ONE LIST, NOT A SECOND PAGE. An author reading their own history is
   reading what everybody else reads; what changes is that some of the rows can
   be acted on. Drawing a separate register would let the two drift, and the
   first thing to drift would be which versions exist.

   THE WHOLE-POST REMOVAL LEADS, AND IT IS WHY THIS BOARD EXISTS. The head never
   falls through to a predecessor (erasure.md §1): removing the current version's
   payload leaves the head selected and rendering absent, so an author who wants
   the post gone and works version by version ends with a post that is still
   there, wearing a mark. The act that does what they mean is therefore the first
   thing on the page, with the footnote saying plainly what the per-version act
   does instead.

   PER-VERSION REMOVAL IS A RARE PATH, AND IT IS DRAWN AS ONE. It rides the
   version's own dateline as a word, not a button of its own: an act that is
   reached deliberately and used once in a hundred visits must not compete with
   the reading. The tombstoned version carries none — its payload is already
   gone.

   THE FRAME IS TALLER THAN A PHONE, for `PostHistory`'s reason and one more:
   the register puts a card above the list, so the scroll this board has to
   show whole is longer than the reader's by exactly that card. */
export const FRAME = { width: 390, height: 1000 };

export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the post" />
      <PostChronicle own />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
