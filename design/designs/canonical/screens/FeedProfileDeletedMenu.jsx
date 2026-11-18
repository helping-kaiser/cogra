/* THE FEED, A DELETED ACCOUNT'S CARD, ITS MENU OPEN (round 55, backlog 223).
   A deleted account still ranks, so its profile card reaches the feed
   (`FeedProfileShapes`' redacted card), and its ⋮ raises the card's menu —
   the deleted account's profile menu less Share this profile, which the
   card's row carries (`FEED_DELETED_PROFILE_MENU`; `FeedProfileMenu.md`'s
   card rule on `ProfileDeletedMenu`'s rows): Save, `Hide this account`,
   Report at the tail. No Mention, no handle. Unstacked over the feed, as
   `FeedProfileMenu`.

   REGISTERED under the `feed` prefix, `feed.menuSheet`, each row named as
   `ProfileDeletedMenu` names it. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={{ ...FEED_FILTER_DEFAULT, kinds: FEED_KINDS.map((kind) => kind.value) }} node="filterTrigger" />} node="band" />
      <FeedList>
        <ProfileFeedCard person={{ handle: "marlow", displayName: "Marlow" }} redacted score="3.40" node="profileCard" />
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <CardMenuSheet items={FEED_DELETED_PROFILE_MENU} ariaLabel="Profile actions" />
    </>
  );
}
