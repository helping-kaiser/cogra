/* Just signed — the author lands on their post wearing Still settling. */
export function Screen() {
  return (
    <>
      <DetailHeader items={OWN_POST_MENU} />
      <DetailColumn>
        <PostCard
          {...SOL_POST}
          variant="detail"
          timestamp="now"
          pending
          bundle={mkBundle(0.1, 1)}
          score={"—"}
          comments={0}
          references={1}
        />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
      <Snackbar message="Signed — it's in the thread now, still settling." offset={80} />
    </>
  );
}
