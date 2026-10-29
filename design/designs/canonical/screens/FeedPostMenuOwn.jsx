/* THE FEED, YOUR OWN POST'S MENU OPEN (seam 248, RM-G9). The own menu off the
   detail: a card of the reader's own in the feed — @sol's salt maps — raises
   the same sheet `RemoveMenu` draws on the detail, over the column the tap was
   made in. Ruling 84's second host, as `FeedPostMenu` is the reader's sheet's:
   the hosting surface gives the drawn state its own paths, `feed.menuSheet.*`.

   THE ROWS ARE `OWN_POST_MENU`, the one atom the detail's own menu reads —
   Save, Cite, Edit, Mark as sensitive, Remove, the license closing it — so the
   feed's own sheet and the detail's cannot disagree. Own menus carry no Hide
   and no Report. The same sheet stands on every host a reader's own card
   stands on off the detail: the own profile's Posts and Comments tabs, and a
   comment card of their own in the feed, its rows `OWN_COMMENT_MENU`'s.

   The card itself hands `PostCard` the rows without the license, because the
   card appends it (`PostCard`'s rule); the sheet draws them whole.

   REGISTERED under the `feed` prefix: the page as `Feed` names it, the sheet
   `menuSheet` with one name per row, as `FeedPostMenu`'s. */
export const NODE = "feed";
const OWN_CARD_ROWS = OWN_POST_MENU.filter((row) => row !== LICENSE_ROW);
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard {...SOL_POST} menuItems={OWN_CARD_ROWS} bundle={mkBundle(0.1, 1)} node="card" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <BottomSheet open ariaLabel="Post actions" node="menuSheet">
        {OWN_POST_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}
