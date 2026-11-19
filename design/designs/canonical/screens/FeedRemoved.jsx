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
   with `Removed` on keeps showing its mark. The same holds for a comment card
   of the reader's own removed in the feed. A tag's page follows the same
   switch at its next derivation (jakob 2026-11-18, tag page (c)). A PROFILE
   KEEPS IT (jakob 2026-11-18, profiles (a)): a removed post or comment keeps
   its place on every profile, the reader's own and anyone's, on every tab,
   whatever the filter holds, and the card there is this one.

   YOUR REMOVED POST KEEPS ITS MENU (jakob 2026-11-12, question 18): the ⋮
   holds `OWN_REMOVED_POST_MENU` — Save, Cite in a new post, Cited by,
   Opinions on this, License terms: your own post's menu less Edit, Mark as sensitive and Remove
   (`FeedRemovedMenuOwn` draws it open). With it
   survive the author, the score, the opinion a reader can still give, the
   comment count and the share.

   REGISTERED under the `feed` prefix: the page as `Feed` names it, the mark
   `card.removalMark` as the detail and the profile name the same master. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard id={SOL_POST.id} author={SOL} timestamp="3d" redacted={{ reason: "author", when: "now" }} score="9.10" comments={2} bundle={mkBundle(0.1, 1)} menuItems={OWN_REMOVED_CARD_MENU} node="card" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
