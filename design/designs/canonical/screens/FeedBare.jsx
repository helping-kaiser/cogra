/* Bare arrival — no invite link, so the genesis moderator's borrowed view. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand handle="noa" displayName="Noa Lindgren" actionLabel="Sign in or join" />
        <ApkLine />
      </CograBand>
      <FeedList>
        <PostCard {...ADA_POST} signedIn={false} />
        <PostCard {...TOBIAS_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
