/* HISTORY, A POST CARD'S MENU OPEN (round 36, backlog 149; jakob 2026-11-11,
   H7). Every card in History is the feed's own card, fully live, so its ⋮
   raises the feed's sheet: the reader's post menu, `READER_POST_MENU`'s rows
   — Save, Cite, Hide @ada, Cited by, Opinions on this, License terms, Report
   at the tail. History adds
   no row and takes none away: it offers no way to remove one thing from it
   (History.md).

   WHAT DIFFERS IS BENEATH. The sheet rises over History's top viewport, as
   `HistoryHidden` draws it, and Hide's aftermath is that board's: the list
   stands as it stood under the snackbar.

   REGISTERED under the `history` prefix: a sheet a host's own card raises is
   drawn over that host and takes its prefix (readme, the sheet node law), so
   the menu is `history.menuSheet` with one name per row, as `feed.menuSheet`
   is `FeedPostMenu`'s. The page beneath is named as `History` names it.

   THE `author` CHIP DRAWS THE MENU ON A HIDDEN AUTHOR'S POST (round 41; jakob
   2026-11-11, M1). A hidden person's posts leave History at its next load
   (History.md), so their card stands only in the History that was open when
   the hide was made (`HistoryHidden`); its menu there reads `Unhide @ada` in
   the Hide row's place, the row's own form (`UNHIDE_ACTOR_LABEL`), and is
   answered by Settings · hidden accounts' snackbar with Undo. The row keeps
   its one name, `hide`: the hidden state is a drawn copy and the rest row
   alone carries the names, the Handle row's precedent (`Settings`). */
export const NODE = "history";
export const PROPS = {
  author: { editor: "enum", options: ["shown", "hidden"], default: "shown" },
};
export const VALS = `shownRow: this.props.author === "hidden" ? "none" : "flex", hiddenRow: this.props.author === "hidden" ? "flex" : "none"`;
export function Screen() {
  return (
    <>
      <HistoryTop>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </HistoryTop>
      <BottomSheet open ariaLabel="Post actions" node="menuSheet">
        {READER_POST_MENU.map((item) =>
          item.node === "hide" ? (
            <React.Fragment key="hide">
              <div style={{ display: "{{shownRow}}", flexDirection: "column" }}>
                <SheetItem label={item.label} node={item.node} />
              </div>
              <div style={{ display: "{{hiddenRow}}", flexDirection: "column" }}>
                <SheetItem label={UNHIDE_ACTOR_LABEL("@ada")} />
              </div>
            </React.Fragment>
          ) : (
            <SheetItem key={item.label} label={item.label} node={item.node} />
          ),
        )}
      </BottomSheet>
    </>
  );
}
