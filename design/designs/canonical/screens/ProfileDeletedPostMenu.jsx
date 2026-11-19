/* A DELETED ACCOUNT'S POST, ITS MENU OPEN ON THE ACCOUNT'S PAGE (round 57,
   backlog 275). The page lands on Posts (jakob 2026-11-17), and with the
   identity alone taken (`ProfileDeleted`'s `contents` = `kept`) each post
   stands as its card under the redacted actor's chip. Its ⋮ raises the
   reader's post menu whole — Save, Cite in a new post, `Hide this account`
   (the same words every card the account authored shows,
   `ProfileDeletedMenu.md`), Cited by, Opinions on this, License terms, Report
   at the tail — `DELETED_POST`'s rows with the license the card appends.
   The page beneath is `ProfileDeletedMenu`'s, the sheet unstacked over it, as
   `ProfilePostsMenu`.

   REGISTERED under the `profile` prefix, `profile.menuSheet`, told apart by
   board. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileDeletedBody tab="posts" contents="kept" />
      <CardMenuSheet items={DELETED_POST_MENU} />
    </>
  );
}
