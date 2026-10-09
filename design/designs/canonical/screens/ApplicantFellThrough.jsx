/* AN APPROVAL THAT FELL THROUGH (jakob 2026-10-07, ruling 60; the
   entry-ceremony rulings, seam 090.4). An applicant is in once two facts
   hold — their own registration and a member's vouch, both landed — and the
   vouch can lapse on the way: its signing runs out unlanded, or the member's
   account goes first. The reader was told `Approved — your registration is
   landing`; now nobody is letting them in, and anyone can.

   IT IS `ApplicantWaiting`'S BOARD WITH THE CARD FLIPPED ONCE MORE, the way
   `ApplicantLanding` and `ApplicantRejected` are — the same band, the same
   borrowed feed, the same bar, numbered to the number. The ruling's own
   words are "returns to waiting", so the card wears the waiting card's
   dress: the default tone, the ask link, and `Got it` to put it away.

   THE CARD NAMES NOBODY. The waiting card names the member whose approval is
   in play, but here the approval that was in play is the one that fell
   through, and which open application the account shows next — the one
   that lapsed, or another member's — is not the reader's to work out. So
   the title says what happened in the landing card's own word — `The
   approval didn't land`, its `Approved` turned round — and the body says
   what is true now in the words the closed card and the profile already
   use: anyone already in can vouch the reader in, and the first vouch lands
   it. The band still names the issuer of the reader's invite link, which no
   approval changes.

   THE ASK LINK IS THE WAY ON, AND IT IS THE CLOSED CARD'S BLOCK. Anyone can
   now be asked, so the block reads as `ApplicantRejected`'s does — `Ask
   someone you know to vouch for you`, its caption saying it works however
   many people it goes to — rather than the waiting card's, which speaks to
   one open answer.

   THE CARD STANDS WHETHER OR NOT THE WAIT WAS PUT AWAY. A dismissal belongs
   to the wait it dismissed (`ApplicantWaiting`), and this is a new state, so
   it comes back the way every state card does; `Got it` puts this one away
   in turn, until the state changes again. The title and the body are
   drafted for jakob. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" line="Browsing from @mira's view while your application lands." />
      </CograBand>
      <FeedList>
        <TaskCard title="The approval didn't land" body="You're waiting again — anyone who's already in can vouch you in, and the first vouch lands it.">
          <PayoutAddress
            bare
            label="Ask someone you know to vouch for you"
            address={ASK_LINK}
            onCopy={() => {}}
            copyLabel="Copy your ask link"
            caption="Send it to anyone who is already in. It does not expire, and it works however many people you send it to."
          />
          <Button variant="outline" selfStart>
            Got it
          </Button>
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} />
        <PostCard {...TOBIAS_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
