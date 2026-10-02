/* A KEPT PICK WAITING FOR ITS REVIEW — what `PadPending`'s anchor becomes
   once the key is back and the kept picks' review was left unsigned (jakob
   2026-10-02, kept picks 1; drawn in the fix-fix round, its 21). A reference
   plate, `PadPending`'s twin: it draws one state of the everyday feed so the
   anchor can be read, and it is wired nowhere — the shell's controls are
   `Feed`'s.

   THE KEY IS HERE, SO THE NOTICE IS GONE. The feed is the ordinary one: no
   key card rides it, because nothing waits on the key any more. What waits is
   the reader's own look at the batch, so the anchor still wears the kept pick
   and `PendingMarker`'s quiet line under it reads `Waiting for your review`
   (`StanceControl`'s `pendingReview`), never `Waiting for your key` and never
   `Still settling` — nothing is signed yet.

   THE TAP OPENS THE REVIEW. Tapping the face opens `KeptPicksReview` with
   every kept pick still in it, never the key notice and never a pad: a kept
   pick signs only from the review's own seal, together with the rest (the
   feed's stance-face edge in `graph.json` carries the case). If the key goes
   again, `PadPending` owns the anchor once more. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...ADA_POST} stancePendingPick={{ pDirected: 0.1, pInterest: 0.1 }} stancePendingReview />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
