/* The feed's filter sheet, open — the whole control lives here: ten kinds that
   combine, the one topic that does not, forms of post, the Order section with
   the seen toggle (shared with search), what else is admitted, and Reset. It
   applies live; dismissal is not a decision.

   THE TOPIC FEED IS A SECTION OF THIS SHEET (jakob, 2026-09-14: "a topic feed
   is just another feed setting"). It is not a tab, not a second feed, and not a
   surface — it is the narrowing a reader already knows how to reach, in the
   control they already use for every other narrowing. The chips are the topics
   held FOR; the way to everything held, including the ones held against, is the
   text button under them. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter defaultOpen topics={FEED_TOPICS} onOpenTopics={() => {}} />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
