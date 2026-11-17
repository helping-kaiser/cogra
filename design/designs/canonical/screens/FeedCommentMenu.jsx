/* THE FEED, A COMMENT CARD'S MENU OPEN (round 48, seam 320-14; backlog 222).
   The comment's menu over the feed, unstacked as the feed's post menu rises
   (`CommentMenu.md`: "it opens unstacked over its host"), its rows
   `COMMENT_MENU`'s exactly — Save, Cite in a new post, Cited by, Opinions on
   this, License terms, Report at the tail, and no Hide row (the comment
   menu's rule). Drawn as `HistoryCommentMenu` draws it over History; no row
   is added, removed or reordered.

   REGISTERED under the `feed` prefix, `feed.menuSheet`, told apart from the
   post's menu by board. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <CommentFeedCard
          id={TOBIAS_COMMENT_ID}
          author={TOBIAS}
          content="That stretch after the second bend is the reason I keep a camera in the glovebox."
          timestamp="1h"
          parent={ADA_POST}
          topics={["glovebox", "coastroad"]}
          score="12.40"
          node="commentCard"
        />
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
      <CardMenuSheet items={COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}