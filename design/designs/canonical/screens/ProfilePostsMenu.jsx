/* THE PROFILE'S POSTS VIEW, A POST CARD'S MENU OPEN (round 36, backlog 149;
   jakob 2026-11-11, H4 and H7). A card on @ada's posts tab is the feed's own
   card, so its ⋮ raises the reader's post menu whole — Save, Cite, Hide @ada,
   License terms, Report at the tail.

   HIDE @ada STAYS, though the profile's own ⋮ carries the same row (jakob,
   H4: "if users expect it there (because they can find it there when in the
   feed) then we should not remove it"). Its aftermath is the profile menu's
   (ProfileMenu.md): the sheet closes, the reader stays on the profile, and
   the profile reads as just hidden (`ProfileOtherHidden`).

   REGISTERED under the `profile` prefix: the card's ⋮ is the profile's own
   card's, so the sheet is `profile.menuSheet`, told apart from the profile's
   own menu (`ProfileMenu`) by board, as `postDetail.menuSheet` serves the
   post's and the comment's menus. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileTabTop tab="posts">
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </ProfileTabTop>
      <CardMenuSheet items={READER_POST_MENU} />
    </>
  );
}
