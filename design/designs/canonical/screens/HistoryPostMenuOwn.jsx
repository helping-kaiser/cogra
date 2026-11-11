/* HISTORY, YOUR OWN POST'S MENU OPEN (round 36; jakob 2026-11-11, H1 and
   H7). The reader's own posts join History like anything they see, so a card
   of their own stands there — @sol's salt maps — and its ⋮ raises the own
   post menu, `OWN_POST_MENU`'s rows: Save, Cite, Edit, Mark as sensitive,
   Remove, the license closing it, and no Hide and no Report (the own menus'
   rule, `FeedPostMenuOwn`).

   The card hands `PostCard` the rows without the license, because the card
   appends it; the sheet draws them whole.

   REGISTERED under the `history` prefix, `history.menuSheet`, as
   `HistoryPostMenu`. */
export const NODE = "history";
export function Screen() {
  return (
    <>
      <HistoryTop>
        <PostCard {...SOL_POST} menuItems={OWN_POST_MENU.filter((row) => row !== LICENSE_ROW)} bundle={mkBundle(0.1, 1)} node="card" />
      </HistoryTop>
      <CardMenuSheet items={OWN_POST_MENU} />
    </>
  );
}
