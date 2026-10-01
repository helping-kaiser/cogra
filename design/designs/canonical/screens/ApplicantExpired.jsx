/* THE APPLICANT DAYS, RUN OUT (jakob 2026-10-01, audit K3.4 and K3.5).

   AN APPLICATION IS BOUNDED BY ITS LINK, the account is not (auth.md,
   *Expiry*): once the window passes unanswered the application stops being
   approvable, and the waiting card's "Nothing else is needed from you" becomes
   a wait that cannot end. This is the state that replaces it.

   `ApplicantRejected`'S SHAPE, WITHOUT A VERDICT. The same shell, the same
   card anatomy, the same ask link — but nobody decided anything, and the
   rejected card's first sentence would be false here. So the title says what
   happened to the application and the body says what it does not mean, in
   the rejected body's own order: what it was, what survives, who can still
   bring the reader in.

   THE ASK LINK RIDES IT, IN THE REJECTED CARD'S WORDS (audit K3.16, ruled
   (b): the link is the applicant's at any time, so it rides the waiting card
   too). One link, one label, one caption wherever it is offered — a reader who
   meets it on two cards must not wonder whether they are two links.

   THE FRESH-INVITE DOOR IS THE RE-ARM (audit K3.5). Either end of the funnel
   re-arms a closed application: a member taking up the ask link, or a fresh
   invite link through `applyWithInvite`. The ask link already sits in the
   card; `Use a fresh invite` is the other end, and it opens `ApplicantRearm`,
   where the link is pasted. The same door rides `ApplicantRejected`'s card.

   THE CARD CANNOT BE PUT AWAY, for the rejected card's reason: it names the
   reader's routes forward, and a route you can dismiss is a route you can
   lose. A waiting card the reader put away comes back as this one — the
   dismissal belonged to the wait, and the wait is over.

   THE BAND TAKES THE REJECTED LINE. "While your application lands" promised a
   landing that is not coming; the line that says what would end the borrowed
   view is true here word for word.

   IT IS AN EXEMPLAR OF `ApplicantRejected`'S SHELL (readme §13, Canvas pages
   and flows): only the card's two controls carry numbers; the band, the posts
   and the nav are wired on that board. */
export function Screen() {
  return (
    <>
      <CograBand>
        <BorrowedViewBand
          handle="mira"
          displayName="Mira Voss"
          avatarSrc="inviter.jpg"
          line="Browsing from @mira's view — your own starts when someone vouches you in."
        />
      </CograBand>
      <FeedList>
        <TaskCard
          title="Your application ran out of time"
          body="Nobody answered before its time was up, and that is all it means. Your account stays exactly as it is, you can keep reading, and any member you know can vouch you in."
        >
          <PayoutAddress
            bare
            label="Ask someone you know to vouch for you"
            address={ASK_LINK}
            onCopy={() => {}}
            copyLabel="Copy your ask link"
            caption="Send it to anyone who is already in. It does not expire, and it works however many people you send it to."
          />
          <Button variant="outline" selfStart>
            Use a fresh invite
          </Button>
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} />
        <PostCard {...TOBIAS_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
