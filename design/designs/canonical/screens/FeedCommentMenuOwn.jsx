/* THE FEED, YOUR OWN COMMENT CARD'S MENU OPEN (round 48, seam 320-14;
   backlog 222). Your own comment in the feed — @sol's on @mira's gallery
   post, as `FeedCommentShapes` draws it — and its ⋮ raises the own comment
   menu, `OWN_COMMENT_MENU`'s rows exactly: Save, Cite, Edit, Remove, Cited
   by, Opinions on this, the license closing it, and no Report
   (`CommentMenuOwn`). Unstacked over the feed, as `HistoryCommentMenuOwn`
   over History; no row is added, removed or reordered.

   REGISTERED under the `feed` prefix, `feed.menuSheet`. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <CommentFeedCard {...SOL_OWN_COMMENT} own node="commentCard" />
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
      <CardMenuSheet items={OWN_COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}