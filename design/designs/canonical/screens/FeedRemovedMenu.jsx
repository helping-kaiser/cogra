/* THE FEED, A REMOVED POST'S MENU OPEN (jakob 2026-11-12, the re-ask's
   eleventh: "full menu. hide targets the user so i could still hide an
   existing user from a deleted post and report can stay aswell"). @ada's post,
   removed by its author, stands as its mark in the feed — `LadderStates`'
   first redacted card — and its ⋮ raises the reader's card menu whole
   (`readerCardMenu`): Save, Cite in a new post, Hide @ada, then Report at the
   tail. The mark carries its removal's date under it, `2d`, as every feed
   card's mark does (`FeedRemoved`'s `now`).

   NO LICENSE ROW, and that is the payload's rule, not this board's: the
   license rode the payload and went with it, so the card appends none
   (`PostCard`). Everything else stays. The record never left the graph, so it
   can still be saved and cited; Hide acts on the author, who still exists and
   still ranks into the reader's feed; Report stays, because a comment section
   or the removal itself may be what the operators should look at.

   The same menu stands on a post removed as illegal (`LadderStates`' second
   card): the rows do not read the reason.

   REGISTERED under the `feed` prefix, as `FeedPostMenu` is: the page as
   `Feed` names it, the mark `card.removalMark` as `FeedRemoved` names it, the
   sheet `menuSheet` with the rows' own names. */
export const NODE = "feed";
const REMOVED_MENU = readerCardMenu("ada");
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard id={ADA_POST.id} author={ADA} timestamp="7d" redacted={{ reason: "author", when: "2d" }} score="15.20" comments={3} bundle={mkBundle(0.55, 0.2)} menuItems={REMOVED_MENU} node="card" />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <BottomSheet open ariaLabel="Post actions" node="menuSheet">
        {REMOVED_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}
