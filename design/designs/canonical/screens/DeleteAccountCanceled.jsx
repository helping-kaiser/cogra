/* THE CANCELED CONFIRMATION (readme §13, the account-deletion round; jakob's
   ruling 2026-09-11, mechanics in `docs/instances/erasure.md` §5 step 3).

   IT IS A SNACKBAR ON THE SURFACE THE READER WAS ON, NOT A SCREEN. The cancel
   is pressed in the band, and the band is on every logged-in surface — a
   confirmation screen would take a reader who tapped two words mid-scroll and
   move them somewhere they did not ask to go. The settings round already
   settled this shape for acts that finish where they are pressed: Revoke, Sign
   out everywhere else, the hidden-account rows. This is one of those, and the
   thing it has to say is short.

   THE BAND IS GONE, AND THE BAND'S ABSENCE IS THE REAL CONFIRMATION. The
   snackbar fades; what tells the reader tomorrow that their account is safe is
   that the countdown is no longer riding their screens. So the board draws the
   surface restored and the snackbar over it, rather than a band in some
   cancelled state — a band saying it no longer applies would be chrome
   outliving its own subject.

   NO UNDO. Every other snackbar in the product offers the way back because the
   act it reports is small and the way back is harmless. Here the way back is
   *re-request the deletion of your account*, and a transient control that
   re-arms an irreversible countdown is exactly the accident the seven days
   exist to catch. The way back is the settings row, where it started.

   WHAT IT SAYS IS WHAT HAPPENED. Nothing had been redacted yet — the request
   was a pending intent — so `nothing was deleted` is the literal truth and the
   fact a reader will want most. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <Snackbar message="Canceled — your account stays, and nothing was deleted." offset={80} />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
