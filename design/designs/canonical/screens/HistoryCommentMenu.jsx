/* HISTORY, A COMMENT CARD'S MENU OPEN (round 36, backlog 149; jakob
   2026-11-11, H7). The comment card is the feed's own, so its ⋮ raises the
   comment's menu, `readerCommentMenu`'s rows — Save, Cite, `Hide @tobias`,
   Cited by, Opinions on this, License terms, Report at the tail.

   IT IS NOT STACKED. `CommentMenu` draws a sheet on the thread's sheet because
   the thread is open beneath it; here the card stands in History's list, so
   the menu rises over History as the post's does (`HistoryPostMenu`), and
   Cited by, Opinions on this, License terms and Report rise over History too.

   REGISTERED under the `history` prefix, `history.menuSheet`, told apart from
   the post's menu by board as `postDetail.menuSheet` serves both.

   THE `author` CHIP DRAWS THE MENU ON A HIDDEN AUTHOR'S COMMENT, the post
   menu's twin (`HistoryPostMenu`, round 41): a hidden person's comments leave
   History at its next load (History.md), so their card stands only in the
   History that was open when the hide was made; its menu there reads
   `Unhide @tobias` in the Hide row's place (`UNHIDE_ACTOR_LABEL`). The row
   keeps its one name, `hide`: the hidden state is a drawn copy. */
export const NODE = "history";
export const PROPS = {
  author: { editor: "enum", options: ["shown", "hidden"], default: "shown" },
};
export const VALS = `shownRow: this.props.author === "hidden" ? "none" : "flex", hiddenRow: this.props.author === "hidden" ? "flex" : "none"`;
export function Screen() {
  return (
    <>
      <HistoryTop>
        <CommentFeedCard
          id={TOBIAS_COMMENT_ID}
          author={TOBIAS}
          content={TOBIAS_COMMENT}
          timestamp="1h"
          parent={ADA_POST}
          topics={["glovebox", "coastroad"]}
          references={1}
          score="12.40"
          node="commentCard"
        />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </HistoryTop>
      <BottomSheet open ariaLabel="Comment actions" node="menuSheet">
        {readerCommentMenu("tobias").map((item) =>
          item.node === "hide" ? (
            <React.Fragment key="hide">
              <div style={{ display: "{{shownRow}}", flexDirection: "column" }}>
                <SheetItem label={item.label} node={item.node} />
              </div>
              <div style={{ display: "{{hiddenRow}}", flexDirection: "column" }}>
                <SheetItem label={UNHIDE_ACTOR_LABEL("@tobias")} />
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
