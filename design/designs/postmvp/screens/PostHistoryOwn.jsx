/* THE AUTHOR'S REGISTER — the same chronicle every reader sees, with the acts
   only its author has (jakob's rulings 2026-09-22; the canvas review
   2026-09-23).

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

   EVERY VERSION WITH A PAYLOAD CARRIES THE ACT — THE CURRENT ONE INCLUDED.
   Removing the head's payload is a real thing an author may want: the older
   versions keep standing and the post renders as removed, the no-fallback rule
   the confirm words before it is pressed (`VersionRemoveConfirm`). It rides the
   version's own dateline as a word, not a button of its own: an act reached
   deliberately and used once in a hundred visits must not compete with the
   reading.

   THE TOMBSTONE'S SLOT SAYS `Already removed`. Its payload is gone, so there is
   no act to offer — but an empty slot on one row of a register reads as an act
   that forgot to draw. The quiet word (`PickedSheet`'s "Described" idiom) stands
   exactly where the act would, in `text-secondary`, not pressable.

   TAGS ARE NOT VERSIONS HERE EITHER. A tag or a reference is its own edge onto
   the post; removing one is done on the edit screen, where it signs its own
   record — never through this register, which acts on versions only.

   THE FRAME IS TALLER THAN A PHONE, for `PostHistory`'s reason and one more:
   the register puts a card above the list, so the scroll this board has to
   show whole is longer than the reader's by exactly that card. The column
   measures 1502px whole; with the 48px header and the 65px bar that is 1615,
   drawn at 1620. */
export const FRAME = { width: 390, height: 1620 };

export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the post" />
      <PostChronicle own />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
