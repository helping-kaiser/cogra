/* Just signed — the author lands on their post wearing Still settling.

   NO OPINIONS ROW HERE (backlog item 55, the score-and-opinions round). A post
   seconds old has nobody's opinion on it yet, and a count of zero draws no row
   — the same reason its score reads a dash rather than a number. Both arrive
   with the post's own settling. */
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
          opinions={0}
        />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
      <Snackbar message="Signed — it's in the thread now, still settling." offset={80} />
    </>
  );
}
