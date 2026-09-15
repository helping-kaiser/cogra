/* Applicant days, everything done — waiting on an approval.

   THE CARD NAMES THE APPROVER, NOT A ROLE (the approver sweep, 2026-09-15).
   It used to wait on "your inviter", a person this reader does not have yet:
   the inviter is fixed at the vouch-back (`invitations.md` §2), and nothing
   has been vouched. What is in play is one member's approval, so the card
   says whose — and the body then says what it does, in a pronoun, because a
   handle twice in three lines is a handle a reader stops reading.

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
        <TaskCard title="All set — waiting on @mira" body="Their approval brings you in. Nothing else is needed from you.">
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
