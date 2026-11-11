/* SAVED, A COMMENT CARD'S MENU OPEN (round 36, backlog 149; jakob
   2026-11-11, H7). The comment's menu over Saved, unstacked as over History
   (`HistoryCommentMenu`): `Unsave` first, the comment being kept (Saved.md),
   then Cite, Cited by, Opinions on this, License terms, Report at the tail,
   and no Hide row (the comment menu's rule).

   REGISTERED under the `saved` prefix, `saved.menuSheet`, told apart from the
   post's menu by board. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <SavedTop>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
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
      </SavedTop>
      <CardMenuSheet items={keptMenu(COMMENT_MENU)} ariaLabel="Comment actions" />
    </>
  );
}
