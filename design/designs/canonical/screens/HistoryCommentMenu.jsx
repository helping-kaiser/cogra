/* HISTORY, A COMMENT CARD'S MENU OPEN (round 36, backlog 149; jakob
   2026-11-11, H7). The comment card is the feed's own, so its ⋮ raises the
   comment's menu, `COMMENT_MENU`'s rows — Save, Cite, Cited by, Opinions on
   this, License terms, Report at the tail — and no Hide row, the comment
   menu's rule (`CommentMenu`).

   IT IS NOT STACKED. `CommentMenu` draws a sheet on the thread's sheet because
   the thread is open beneath it; here the card stands in History's list, so
   the menu rises over History as the post's does (`HistoryPostMenu`), and
   Cited by, Opinions on this, License terms and Report rise over History too.

   REGISTERED under the `history` prefix, `history.menuSheet`, told apart from
   the post's menu by board as `postDetail.menuSheet` serves both. */
export const NODE = "history";
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
          score="12.40"
          node="commentCard"
        />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </HistoryTop>
      <CardMenuSheet items={COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}
