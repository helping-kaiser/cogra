/* HISTORY, YOUR REMOVED COMMENT'S MENU OPEN (round 55, backlog 223). Your own
   comment joins History like anything you see, and a thing removed after it
   was seen keeps its place there, wearing its mark (History.md) — @sol's
   comment on @mira's gallery post, `HistoryCommentMenuOwn`'s card, removed —
   and its ⋮ raises `OWN_REMOVED_COMMENT_MENU`: Save, Cite in a new post,
   Cited by, Opinions on this, License terms, your own comment's menu less
   Edit and Remove (CommentRemoved.md). Unstacked over History, as
   `HistoryCommentMenuOwn`.

   REGISTERED under the `history` prefix, `history.menuSheet`, the mark
   `commentCard.removalMark` as `CommentCard` names it. */
export const NODE = "history";
export function Screen() {
  return (
    <>
      <HistoryTop>
        <CommentFeedCard {...SOL_OWN_COMMENT} redacted={{ reason: "author", when: "2d" }} node="commentCard" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </HistoryTop>
      <CardMenuSheet items={OWN_REMOVED_COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}
