/* THE FEED, YOUR POST REMOVED IN PLACE (seam 248, RM-G9). Where the feed's
   `Remove` lands: the feed the reader asked from, and @sol's card standing
   where it stood, as its mark — `Removed by its author` where the words and
   pictures were, the post's own skeleton around it (`Removed`'s, at feed
   scale). Never a silent disappearance: the card does not leave under the
   reader's thumb.

   IT LEAVES AT THE FEED'S NEXT RE-DERIVE, BY THE READER'S OWN FILTER. A
   feed's filter keeps `Removed` off by default (`FeedSheet`), so the next
   time this device derives the feed — a refresh, a cold open, a changed
   filter — the removed post is cut like any other removed post; a filter
   with `Removed` on keeps showing its mark. The same holds on every host a
   reader's own card is removed from off the detail: the own profile's Posts
   and Comments tabs, and a comment card of their own in the feed.

   A REMOVED POST HAS NO MENU LEFT (`Removed`'s rule): the ⋮ goes with the
   payload. What survives is the author, the score, the opinion a reader can
   still give, the comment count and the share.

   REGISTERED under the `feed` prefix: the page as `Feed` names it, the mark
   `card.removalMark` as the detail and the profile name the same master. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard author={SOL} timestamp="3d" redacted={{ reason: "author", when: "now" }} score="9.10" comments={2} bundle={mkBundle(0.1, 1)} menuItems={[]} node="card" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
