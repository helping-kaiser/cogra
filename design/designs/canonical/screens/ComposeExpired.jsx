/* The did-not-land notice (Q38) — a calm card in the member's shell. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <TaskCard title="Your post didn't land" body={'"Salt maps of the coast road" couldn\'t finish settling. Nothing was spent — your draft is saved.'}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text" size="sm">
              Dismiss
            </Button>
            <Button size="sm">Open the draft</Button>
          </div>
        </TaskCard>
        <PostCard {...ADA_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
