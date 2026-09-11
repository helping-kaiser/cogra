/* Applicant days, everything done — waiting on the inviter's approval.

   THE CARD CAN BE PUT AWAY (jakob 2026-09-09). Every other task card names
   something to do; this one names something to wait for, and a card that asks
   nothing has no reason to hold the top of the feed for days. `Got it` is the
   card's only control, so it takes `TaskCard`'s secondary dress — outlined and
   left-aligned, the way `Resend the link` sits. The dismissal is remembered on
   the device: putting it away twice would say the first tap did nothing. */
export function Screen() {
  return (
    <>
      <CograBand>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" line="Browsing from @mira's view while your application lands." />
      </CograBand>
      <FeedList>
        <TaskCard title="All set — waiting on your inviter" body="@mira's approval brings you in. Nothing else is needed from you.">
          <Button variant="outline" selfStart>
            Got it
          </Button>
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} />
        <PostCard {...TOBIAS_POST} signedIn={false} />
      </FeedList>
      <Snackbar message="Your post waits with your application — it arrives with you." />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
