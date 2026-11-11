/* HISTORY, YOUR OWN COMMENT'S MENU OPEN (round 36; jakob 2026-11-11, H1 and
   H7). The reader's own comment joins History like anything they see — @sol's
   on @mira's gallery post, as `FeedCommentShapes` draws it — and its
   ⋮ raises the own comment menu, `OWN_COMMENT_MENU`'s rows: Save, Cite,
   Edit, Remove, Cited by, Opinions on this, the license closing it, and no
   Report (`CommentMenuOwn`). Unstacked, over History, as `HistoryCommentMenu`.

   REGISTERED under the `history` prefix, `history.menuSheet`. */
export const NODE = "history";
export function Screen() {
  return (
    <>
      <HistoryTop>
        <CommentFeedCard {...SOL_OWN_COMMENT} node="commentCard" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </HistoryTop>
      <CardMenuSheet items={OWN_COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}
