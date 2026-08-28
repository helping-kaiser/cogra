/* The landing — the live public feed from @mira's borrowed view (readme §13). */
export function Screen() {
  return (
    <>
      <CograBand>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" actionLabel="Sign in or join" />
        <ApkLine />
      </CograBand>
      <FeedList>
        <PostCard {...ADA_POST} signedIn={false} targetLabel="this post" />
        <PostCard {...TOBIAS_POST} signedIn={false} targetLabel="this post" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
