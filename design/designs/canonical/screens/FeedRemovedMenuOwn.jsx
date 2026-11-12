/* THE FEED, YOUR REMOVED POST'S MENU OPEN (jakob 2026-11-12, question 18 (2):
   "i can still cite this (maybe in a folloup post to explain why i deleted
   it)"). @sol's card stands as its mark, `FeedRemoved`'s, and its ⋮ raises
   `OWN_REMOVED_POST_MENU`: Save, then Cite in a new post. Every other row of
   your own post's menu needs the payload and goes with it — Edit and Mark as
   sensitive open the edit, Remove is done, and the license rode the payload.
   The detail's header (`Removed`) carries the same two rows.

   REGISTERED under the `feed` prefix, as `FeedRemovedMenu` is: the page as
   `Feed` names it, the mark `card.removalMark`, the sheet `menuSheet` with the
   rows' own names. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard id={SOL_POST.id} author={SOL} timestamp="3d" redacted={{ reason: "author", when: "now" }} score="9.10" comments={2} bundle={mkBundle(0.1, 1)} menuItems={OWN_REMOVED_POST_MENU} node="card" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <BottomSheet open ariaLabel="Post actions" node="menuSheet">
        {OWN_REMOVED_POST_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}
