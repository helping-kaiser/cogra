/* HISTORY, A POST CARD'S MENU OPEN (round 36, backlog 149; jakob 2026-11-11,
   H7). Every card in History is the feed's own card, fully live, so its ⋮
   raises the feed's sheet: the reader's post menu, `READER_POST_MENU`'s rows
   — Save, Cite, Hide @ada, License terms, Report at the tail. History adds
   no row and takes none away: it offers no way to remove one thing from it
   (History.md).

   WHAT DIFFERS IS BENEATH. The sheet rises over History's top viewport, as
   `HistoryHidden` draws it, and Hide's aftermath is that board's: the list
   stands as it stood under the snackbar.

   REGISTERED under the `history` prefix: a sheet a host's own card raises is
   drawn over that host and takes its prefix (readme, the sheet node law), so
   the menu is `history.menuSheet` with one name per row, as `feed.menuSheet`
   is `FeedPostMenu`'s. The page beneath is named as `History` names it. */
export const NODE = "history";
export function Screen() {
  return (
    <>
      <HistoryTop>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </HistoryTop>
      <CardMenuSheet items={READER_POST_MENU} />
    </>
  );
}
