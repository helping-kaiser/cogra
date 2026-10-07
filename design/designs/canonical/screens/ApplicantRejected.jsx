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

   IT WEARS THE OLIVE (jakob 2026-10-02, the olive split). The way in now
   waits on the reader — the ask link sent to someone who is in — so the card
   asks for their action and stands on the account-notice register
   (`tone="notice"`); the waiting card, which asks nothing, does not.

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

   THE ASK LINK IS THE ONE WAY FORWARD (jakob 2026-10-02). The account exists
   and nothing about it has a clock; the only thing missing is a vouch, and a
   vouch comes from any member — the ask link is how the reader reaches one.
   The block and its reading are the whole of what the card offers.

   A POST SIGNED HERE WAITS FOR THE VOUCH (jakob 2026-10-02). From this shell
   New post still opens the wizard, and the seal stages the post on the
   device; with no application live, the exit's snackbar says what it waits
   for — `Your post waits — it arrives when someone vouches you in.` — never
   that it waits with an application. The post's second tap answers with the
   same line wherever it is made (jakob 2026-10-05): `New post` on this bar,
   and the menus' `Cite in a new post` and `Mention in a new post`. A first
   post waits on the device, never sent, until someone vouches the reader
   in. The other kinds' second taps answer
   in the same grammar: `Your opinion waits — it arrives when someone
   vouches you in.` and `Your topic waits — it arrives when someone vouches
   you in.`

   THE BAND NAMES @kel STILL. The vantage rule resolves to the most specific
   actor an arrival carries, and the arrival is unchanged: this reader came
   through @kel's link and the feed they are reading is the one that link
   carried. Re-ranking somebody's whole feed as a side effect of being turned
   down would be a punishment the ruling is at pains not to impose. The band's
   LINE changes, because the old one promised an approval that is not coming.
   Once a member takes the reader up through the ask link, the card flips to
   the landing card and the band takes the landing line, still naming @kel
   (jakob 2026-10-05).

   THE FEED FILTER RIDES THE BAND, as on every feed view, guests and
   applicants included (readme §13, the feed's filter on screen).

   REGISTERED under the feed's own prefix (design ⇄ impl seam 078): the shell
   is the feed, named as `Feed` names it; the band under the CoGra band is
   `borrowedViewBand`, and the card is `application`, its ask link `link`, as
   on `ProfileApplicant`. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band">
        <BorrowedViewBand
          handle="kel"
          displayName="Kel Moreau"
          line="Browsing from @kel's view — your own starts when someone vouches you in."
          node="borrowedViewBand"
        />
      </CograBand>
      <FeedList>
        <TaskCard
          tone="notice"
          title="@kel closed your application"
          body="That was @kel's call, and it is the only thing it decides. Your account stays exactly as it is, you can keep reading, and any member you know can vouch you in instead."
          node="application"
        >
          <PayoutAddress
            bare
            label="Ask someone you know to vouch for you"
            address={ASK_LINK}
            onCopy={() => {}}
            copyLabel="Copy your ask link"
            caption="Send it to anyone who is already in. It does not expire, and it works however many people you send it to."
            node="link"
          />
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} node="card" />
        <PostCard {...TOBIAS_POST} signedIn={false} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
