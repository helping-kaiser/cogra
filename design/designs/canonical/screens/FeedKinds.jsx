/* THE FEED WITH ALL FOUR KINDS ON — the three-feed-cards round (2026-09-30),
   executing jakob's ruling from the fifteen-first round: the four served
   kinds, Posts, Comments, Profiles and Tags, everywhere, feed and search
   alike. The filter has offered all four since the V1.0 scope cut; this is
   what a reader meets once they turn the other three on.

   A BOARD OF ITS OWN, not new cards on `Feed`. The everyday feed is drawn at
   the filter's default, which is `Posts` alone, and a comment on it would be
   a card its own trigger says is not there. So the kinds arrive the way the
   post-MVP chat and message cards arrived (`ChatFeedCards`): one board with
   the kinds turned on, the trigger reading them back as it always does — `All
   kinds`, the filter's own summary at the full set (jakob 2026-10-02:
   the state, never the count, when every kind is on), nothing added.

   THE THREE NEW CARDS LEAD, the post below them, for the same board's
   reason: they are what this board records, and a card cut off at the fold
   is a card nobody can check. The post is the ordinary `PostCard`, standing
   for the feed's own cards. The scores agree with that order — every card
   wears its figure, and each one outranks the card below it — so the board
   never draws a feed out of its own rank.

   EACH KIND IS ITS OWN MASTER (`_shared.jsx`, the V1.0 feed kinds), in the
   anatomy jakob picked (2026-10-01): the comment as a slice of its thread,
   the person as the top of their profile, the tag with why it reaches the
   reader and a glimpse of what is behind it. Every card's row is the unified
   one — opinion · score · the kind's own act · share — and every tap lands on
   a board that already exists: the comment's head row on the post, the rest
   of it and its reply glyph on its thread at the comment, the person's card
   on their profile, the tag's card on its page and its compose glyph on the
   composer with the tag staged. The variants each card meets live on
   `FeedCommentShapes`, `FeedProfileShapes` and `FeedTagShapes`.

   NO SECOND ALGORITHM. All four kinds rank by the ordinary rank, side by side
   — the default feed's order, the kinds only widening what it may admit.

   A TINY SCORE NEVER READS ZERO (jakob 2026-11-12, the re-ask's twentieth;
   the `score` chip). The post at the foot, whose figure the three above
   outrank whatever it reads: `usual` its 9.10; `tiny` a computed figure
   under 0.005, which two decimals would print as `0.00`, rounded away from
   zero to `0.01`; `tiny-negative` its twin below zero, `−0.01`. The card
   never carries more than two decimals; the trace says more
   (`FeedEntry`'s own `score` chip). `ExplainableNumber` holds the rule.

   REGISTERED under the `feed` prefix (seam 248), the cards named as
   `History` names them: `commentCard`, `profileCard`, `tagCard`, `card`. */
const EVERY_KIND = { ...FEED_FILTER_DEFAULT, kinds: FEED_KINDS.map((kind) => kind.value) };

export const NODE = "feed";
export const PROPS = { score: { editor: "enum", options: ["usual", "tiny", "tiny-negative"], default: "usual" } };
export const VALS = `postScore: this.props.score === "tiny" ? "0.01" : this.props.score === "tiny-negative" ? "−0.01" : "9.10"`;
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={EVERY_KIND} node="filterTrigger" />} node="band" />
      <FeedList>
        <CommentFeedCard
          id={TOBIAS_COMMENT_ID}
          author={TOBIAS}
          content="That stretch after the second bend is the reason I keep a camera in the glovebox."
          timestamp="1h"
          parent={ADA_POST}
          topics={["glovebox", "coastroad"]}
          references={1}
          score="12.40"
          node="commentCard"
        />
        <ProfileFeedCard person={MIRA} src="inviter.jpg" bio="Runs the stand by the sea wall — honey from the headland hives." score="11.70" node="profileCard" />
        <TagFeedCard id={SALTMAPS_TAG_ID} name="#saltmaps" through={["ada", "tobias"]} tagged={SALTMAPS_TAGGED} score="10.30" node="tagCard" />
        <PostCard {...SOL_POST} score="{{postScore}}" bundle={mkBundle(0.3, 0.45)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
