/* A COMMENT'S EDIT HISTORY, AS ITS AUTHOR MEETS IT — the comment's chronicle
   with the post register's acts joined (jakob's canvas review, 2026-09-23:
   comments get the delete options too).

   IT IS THE POST'S REGISTER, ONE KIND DOWN, AND IT IS ONE LIST. The versions are
   the ones every reader sees on `CommentHistory`, drawn by the same prelude;
   what the author gets is two things added, never a second list — so the two
   pages cannot disagree about which versions exist.

   `Remove the whole comment` LEADS, for the post's reason. The head never falls
   through to a predecessor (erasure.md §1), so an author removing version after
   version would end with a comment still standing in the thread wearing a mark.
   The act that does what they mean is the first thing on the page, under the
   same footnote the post's lead carries.

   EVERY VERSION WITH A PAYLOAD CARRIES `Remove this version`, THE CURRENT ONE
   INCLUDED; removing the head leaves the older versions standing and the comment
   rendering removed in its thread. The tombstone's slot says `Already removed`.

   THE CONFIRM IS NOT DRAWN AGAIN. Both removals open the post boards' dialog at
   comment scale — `VersionRemoveConfirm` is the master for the per-version act
   and for the whole-comment act alike: the same surface, the same emphasis, the
   safe action filled. One think-twice shape for one kind of decision.

   THE FRAME IS TALLER THAN A PHONE so the register shows whole, the lead card
   and the law at the foot included: the column measures 745px, and with the
   48px header and the 65px bar that is 858, drawn at 860. */
export const FRAME = { width: 390, height: 860 };

export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the comment" />
      <CommentChronicle own />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
