/* YOUR PROFILE'S EDIT HISTORY, AS YOU MEET IT — the profile's chronicle with
   the post register's acts joined (jakob's canvas review, 2026-09-23:
   "removing the contents of your profile is not deleting your account — you
   need to be able to do so").

   IT IS ONE LIST, the one every reader sees on `ProfileHistory`, drawn by the
   same prelude; the register adds acts and never versions.

   `Remove every version` LEADS, AND ITS FOOTNOTE DRAWS THE ACCOUNT'S EDGE. A
   profile is the one kind whose removal can be mistaken for leaving, so the
   line under the act says what it does NOT touch: the account, the handle, and
   everything published under it all stay — the act only empties the profile's
   history. Deleting the account is a different act, in settings, with its own
   seven days (erasure.md §5), and nothing on this page reaches it.

   EVERY VERSION WITH A PAYLOAD CARRIES `Remove this version`, the current one
   included: removing the head leaves the older versions standing and the
   profile rendering its contents removed — no earlier name or face takes their
   place, the no-fallback rule the confirm words. The tombstone's slot says
   `Already removed`.

   THE CONFIRM IS NOT DRAWN AGAIN. Both removals open the post boards' dialog at
   profile scale — `VersionRemoveConfirm` is the master for the per-version act
   and for the lead's every-version act alike.

   THE FRAME IS TALLER THAN A PHONE so the register shows whole: the column
   measures 1149px; with the 48px header and the 65px bar that is 1262, drawn at
   1264. */
export const FRAME = { width: 390, height: 1264 };

export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the profile" />
      <ProfileChronicle own />
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
