/* THE FEED, A REMOVED POST'S MENU OPEN (jakob 2026-11-12, the re-ask's
   eleventh: "full menu. hide targets the user so i could still hide an
   existing user from a deleted post and report can stay aswell"). @ada's post,
   removed by its author, stands as its mark in the feed — `LadderStates`'
   first redacted card — and its ⋮ raises the reader's card menu whole
   (`readerCardMenu`, the license appended): Save, Cite in a new post, Hide
   @ada, License terms, then Report at the tail. The mark carries its removal's date under it, `2d`, as every feed
   card's mark does (`FeedRemoved`'s `now`).

   THE LICENSE ROW STAYS (jakob 2026-11-12: "someone might have used my
   content already under its license regulations"; on another's post too,
   confirmed by jakob 2026-11-13, point E): the card appends it as
   on any post, its sheet showing the terms the post was published under. The record never left the graph, so it
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
/* The sheet's rows: the card's, the license before the report — `READER_POST_MENU`'s order. */
const REMOVED_SHEET = readerPostMenu("ada");
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
        {REMOVED_SHEET.map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}
