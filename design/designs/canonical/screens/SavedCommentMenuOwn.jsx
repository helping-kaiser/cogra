/* SAVED, YOUR OWN COMMENT'S MENU OPEN (round 48, seam 320-14; backlog 222).
   Your own comment kept in Saved — @sol's, as `HistoryCommentMenuOwn` draws
   it — and its ⋮ raises the own comment menu (`FeedPostMenuOwn.md`: the own
   menu on Saved holds the own comment menu's rows), `Unsave` first, the
   comment being kept (Saved.md), then Cite, Edit, Remove, Cited by, Opinions
   on this and the license, no Report. Unstacked over Saved, as
   `SavedCommentMenu`; no row is added, removed or reordered.

   REGISTERED under the `saved` prefix, `saved.menuSheet`. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <SavedTop>
        <CommentFeedCard {...SOL_OWN_COMMENT} own node="commentCard" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </SavedTop>
      <CardMenuSheet items={keptMenu(OWN_COMMENT_MENU)} ariaLabel="Comment actions" />
    </>
  );
}