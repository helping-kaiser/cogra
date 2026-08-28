/* The feed's filter sheet, open — the whole control lives here: ten kinds that
   combine, forms of post, the Order section with the seen toggle (shared with
   search), what else is admitted, and Reset. It applies live; dismissal is not
   a decision. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter defaultOpen />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
