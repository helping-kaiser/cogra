/* SAVED, A PROFILE CARD'S MENU OPEN (round 55, backlog 223). A person kept in
   Saved stands as the feed's own profile card (Saved.md), and its ⋮ raises
   the card's own rows on every host (`FeedProfileMenu.md`), Saved's first
   reading `Unsave`: Unsave, Mention in a new post, `Hide @mira`, Report at
   the tail. Unstacked over Saved, as `HistoryProfileMenu` over History; no row
   is added, removed or reordered.

   HIDING FROM HERE LEAVES THE CARD WHERE IT IS: a hidden account's things and
   profile stay in Saved.

   REGISTERED under the `saved` prefix, `saved.menuSheet`, each row named as
   `ProfileMenu` names it. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <SavedTop>
        <ProfileFeedCard person={MIRA} src="inviter.jpg" bio="Runs the stand by the sea wall — honey from the headland hives." score="11.70" node="profileCard" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </SavedTop>
      <CardMenuSheet items={keptMenu(FEED_PROFILE_MENU("mira"))} ariaLabel="Profile actions" />
    </>
  );
}
