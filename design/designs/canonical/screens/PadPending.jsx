/* A PICK KEPT PENDING — the anatomy of what `PadKeyAbsent`'s "Keep it
   pending, restore later" leaves behind (the key-loss round). A reference
   plate: it draws one state of `KeyElsewhere`'s feed so the anchor can be
   read, and it is wired nowhere — the shell's controls are `KeyElsewhere`'s.

   THE ANCHOR WEARS THE PICK, NOT THE BUNDLE. Nothing was signed, so the
   bundle behind the post is what it was; but the reader chose a face and kept
   it, and an anchor still showing the resting face would say the pick was
   lost. So the face is the kept pick's, and `PendingMarker`'s quiet line
   under it says what it waits on — `Waiting for your key`, never `Still
   settling`, which means signed and not yet ordered. Tapping the face opens
   `PadKeyAbsent` again, holding the kept pick.

   THE LIFECYCLE OF A KEPT PICK (`PadKeyAbsent` carries it in full): it lives
   on this device only, survives a restart, and waits beside any other kept
   picks until the key is restored — then they sign together, in one batch
   the reader reviews first (`KeptPicksReview`, then `KeptPicksSeal`). */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <TaskCard
          title="Your key isn't on this browser"
          body="Restore it with your recovery code to post, vouch, and act. Until then, anything you sign waits as pending."
        >
          <div style={{ display: "flex" }}>
            <Button size="sm">Restore the key</Button>
          </div>
        </TaskCard>
        <PostCard {...ADA_POST} stancePendingPick={{ pDirected: 0.1, pInterest: 0.1 }} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
