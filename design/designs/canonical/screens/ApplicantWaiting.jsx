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
   the device: putting it away twice would say the first tap did nothing.

   THE ASK LINK RIDES THIS CARD TOO (jakob 2026-10-01). auth.md says the
   applicant can copy it at any time, so the canvas no longer keeps it for a
   rejection. It is `ApplicantRejected`'s block — the same copy control and
   mono line, `bare` inside the card that explains it — with a label and
   caption true for a live application. Any member who holds the ask can
   vouch, and the first vouch lands it (jakob 2026-10-07, item 58), so the
   caption says only that the link does not expire.

   THE FEED FILTER RIDES THE BAND, as on every feed view, guests and
   applicants included (readme §13, the feed's filter on screen).

   A PUT-AWAY CARD COMES BACK WHEN THE STATE CHANGES (jakob 2026-10-01, audit
   K3.4). The dismissal belongs to the wait, not to the application: once the
   application is approved or closed, the shell shows that state's card
   whether or not this one was put away — `ApplicantLanding`,
   `ApplicantRejected` — because a reader who dismissed a wait has not
   dismissed what ended it. The wait itself has no clock: a verified
   application waits on its vouch for as long as it takes.

   THE SNACKBAR IS `New post`'S ANSWER (PR-103, round 16). Applicant acting
   is post-MVP, so the bar's `New post` never opens the wizard on any
   applicant shell: it answers in place in the applicant-foot family's voice,
   `You can post once you're in.`, drawn once here. A stance face answers the
   same way with `You can give your opinion once you're in.`, and the pad
   never blooms. Both wear auth.md's locked look (jakob 2026-10-16), the
   comment foot's: `composeOpacity` on the bar and `stanceOpacity` on every
   card, at the disabled opacity and still tappable — as on every applicant
   shell and `ProfileApplicant`'s bar.

   REGISTERED under the feed's own prefix (round 7), named as
   `ApplicantRejected` names the same shell: the card is `application`, its ask
   link `link`, and `Got it` is `dismiss`, as on the vouch-back card. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band">
        <BorrowedViewBand
          handle="mira"
          displayName="Mira Voss"
          avatarSrc="inviter.jpg"
          line="Browsing from @mira's view while your application lands."
          node="borrowedViewBand"
        />
      </CograBand>
      <FeedList>
        <TaskCard title="All set — waiting on @mira" body="Their approval brings you in. Nothing else is needed from you." node="application">
          <PayoutAddress
            bare
            label="Your ask link"
            address={ASK_LINK}
            onCopy={() => {}}
            copyLabel="Copy your ask link"
            caption="It does not expire."
            node="link"
          />
          <Button variant="outline" selfStart node="dismiss">
            Got it
          </Button>
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} stanceOpacity="var(--state-disabled)" node="card" />
        <PostCard {...TOBIAS_POST} signedIn={false} stanceOpacity="var(--state-disabled)" node="card" />
      </FeedList>
      <Snackbar message="You can post once you're in." node="snackbar" />
      <BottomNav active="feed" slots={ALL_SLOTS} inline composeOpacity="var(--state-disabled)" node="bottomBar" />
    </>
  );
}
