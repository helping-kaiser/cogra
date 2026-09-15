/* THE APPLICANT DAYS, TURNED DOWN — and not ended (jakob 2026-09-15).

   IT IS `ApplicantWaiting`'S BOARD WITH THE CARD FLIPPED. Everything else is
   the same shell: the same band, the same borrowed feed, the same bar. That is
   the point of drawing it here rather than as a screen of its own — nothing
   was taken away. The account still reads, the feed still ranks, and the one
   thing that changed is the card that used to say "waiting".

   `TaskCard`, LIKE ITS SIBLINGS. Every applicant board says what is happening
   and what to do about it in the same card, and this one has more reason to
   than any of them: it is the only card in the product that has to deliver a
   no without the reader concluding they were thrown out.

   THE CARD CANNOT BE PUT AWAY. `ApplicantWaiting` earned its `Got it` by
   naming something to wait for; this card names the only route forward the
   reader has, and a route you can dismiss is a route you can lose.

   NO DELETION LANGUAGE, and no verdict either. @kel closed one application.
   That is one member declining to vouch, which is a thing a member is
   entitled to do and which says nothing about the person — so the card says
   whose decision it was, says what survives it, and then spends its remaining
   words on the ask link rather than on consolation.

   THE ASK LINK IS THE INVITE LINK'S MIRROR, and the mirror is exact except
   where it must not be. Same card anatomy, same copy control, same mono block
   — but it points at a PERSON rather than at a slot, so it has no expiry and
   no slot state to report, and it is `bare` because it sits inside the card
   that explains it and a card inside a card is two containers saying one
   thing.

   THE BAND NAMES @kel STILL. The vantage rule resolves to the most specific
   actor an arrival carries, and the arrival is unchanged: this reader came
   through @kel's link and the feed they are reading is the one that link
   carried. Re-ranking somebody's whole feed as a side effect of being turned
   down would be a punishment the ruling is at pains not to impose. The band's
   LINE changes, because the old one promised an approval that is not coming. */
export function Screen() {
  return (
    <>
      <CograBand>
        <BorrowedViewBand
          handle="kel"
          displayName="Kel Moreau"
          line="Browsing from @kel's view — your own starts when someone vouches you in."
        />
      </CograBand>
      <FeedList>
        <TaskCard
          title="@kel closed your application"
          body="That was @kel's call, and it is the only thing it decides. Your account stays exactly as it is, you can keep reading, and any member you know can vouch you in instead."
        >
          <PayoutAddress
            bare
            label="Ask someone you know to vouch for you"
            address={ASK_LINK}
            onCopy={() => {}}
            copyLabel="Copy your ask link"
            caption="Send it to anyone who is already in. It does not expire, and it works however many people you send it to."
          />
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} />
        <PostCard {...TOBIAS_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
