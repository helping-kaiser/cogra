/* THE FEED, A PROFILE CARD'S MENU OPEN (round 36; jakob 2026-11-11, H2 and
   H7). The ⋮ on a person's card in the feed raises the profile's own menu
   less the share row the card's row already carries (ProfileMenu.md): Save,
   Mention in a new post, Hide @mira, and Report at the tail — every
   other-person menu's (ruling 75; H2), as the deleted account's card already
   had it. The same rows on every host the card stands on: the feed, History
   and Saved.

   BENEATH IS `FeedKinds`' column, the board that wires the card at rest,
   scrolled to @mira's card.

   REGISTERED under the `feed` prefix — the feed's own card raises it, so it
   takes the host's prefix (readme, the sheet node law), as `FeedPostMenu`'s
   does: `feed.menuSheet`, each row named as `ProfileMenu` names it. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={{ ...FEED_FILTER_DEFAULT, kinds: FEED_KINDS.map((kind) => kind.value) }} node="filterTrigger" />} node="band" />
      <FeedList>
        <ProfileFeedCard person={MIRA} src="inviter.jpg" bio="Runs the stand by the sea wall — honey from the headland hives." score="11.70" node="profileCard" />
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <CardMenuSheet items={FEED_PROFILE_MENU("mira")} ariaLabel="Profile actions" />
    </>
  );
}
