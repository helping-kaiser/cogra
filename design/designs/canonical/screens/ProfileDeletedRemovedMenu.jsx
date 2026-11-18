/* A DELETED ACCOUNT'S SWEPT POST, ITS MENU OPEN ON THE ACCOUNT'S PAGE (round
   57, backlog 275). With the content taken too (`ProfileDeleted`'s
   `contents` = `removed`) each post stands as its mark, `Removed by its
   author`, swept content's mark, and its ⋮ raises the same rows as a kept
   one — the same rows on a removed post as on any (`FeedRemovedMenu`): Save,
   Cite in a new post, `Hide this account`, Cited by, Opinions on this,
   License terms, Report at the tail. The page beneath is
   `ProfileDeletedMenu`'s on Posts, the sheet unstacked over it.

   REGISTERED under the `profile` prefix, `profile.menuSheet`, told apart by
   board. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileDeletedBody tab="posts" contents="removed" />
      <CardMenuSheet items={DELETED_POST_MENU} />
    </>
  );
}
