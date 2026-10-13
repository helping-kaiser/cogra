/* Landed — approved, and the vouch-back opens the way.

   THE BORROWED VIEW ENDS ON ANY FIRST OPINION (jakob 2026-10-02, C13 revised:
   their own graph exists, so their own feed exists). The landed member's
   first signed opinion — on @mira, on a post, on anyone — ends the band and
   hands the feed over to their own vantage. The vouch-back is not the gate:
   a member may opine on whoever they please and never vouch back at all. So
   the band names the view and asks for nothing — no `Vouch back` word rides
   it — and its line says what ends the borrowing.

   THE CARD PUTS AWAY FOR GOOD, SILENTLY. `Got it` is a true dismiss, and its
   word promises no later (jakob 2026-10-02): the card does not come back
   and nothing stands in its place — no snackbar, no reminder, no residue.
   Vouching back stays possible forever, from @mira's
   profile: ANY OPINION ON @mira IS THE VOUCH-BACK while the pair is
   incomplete, wherever it is signed — this card or her profile's anchor, the
   card put away or not — and it opens `VouchedIn`.

   THE CARD WEARS THE OLIVE REGISTER (the olive split: it asks the reader to
   act), drawn once as `VouchBackCard` in `_shared.jsx` and shared with the
   pad's board.

   THE CARD'S ACT IS THE FACE (jakob 2026-10-13, seam 157/165). The vouch-back
   is an opinion like any other, so the card's act is the opinion's own
   control — `StanceControl`'s anchor, the very face every post and profile
   wears, never a button of its own: the tap blooms the vouch-back
   pad, the hold signs the gentle default, and a signed vouch-back opens the
   ceremony either way, as the profile's anchor already does. One line beside it teaches the gesture,
   `Tap the face to vouch back.`, and claims nothing about first-ness: the
   card stands while the member holds other opinions too, and the band's line
   is where the first opinion is named. `Got it` takes the row's leading
   edge, so the face keeps the trailing seat the act always had.

   REGISTERED under the feed's own prefix (design ⇄ impl seam 086): the shell
   is the feed, named as `Feed` names it, the band under the CoGra band
   `borrowedViewBand` as on `ApplicantRejected`; the card is `vouchCard`, its
   `Got it` `dismiss`, its line `hint` and its face `stance`, as
   `VouchBackPad` names the same control. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band">
        <BorrowedViewBand
          handle="mira"
          displayName="Mira Voss"
          avatarSrc="inviter.jpg"
          line="Browsing from @mira's view — your first opinion starts your own."
          node="borrowedViewBand"
        />
      </CograBand>
      <FeedList>
        <VouchBackCard
          body="Vouch back to open the way from your side — your opinion toward @mira, and your feed grows from it. Vouching opens the opinion control, set to a gentle default."
          actions={
            <>
              <Button variant="text" style={{ color: "var(--on-tertiary-container)" }} node="dismiss">
                Got it
              </Button>
              <span style={{ flex: 1 }} />
              <VouchBackHint node="hint" />
              <StanceControl node="stance" targetLabel="@mira" helpLabel="Your vouch back" help={YOUR_VOUCH_BACK_HELP} />
            </>
          }
          node="vouchCard"
        />
        <PostCard {...ADA_POST} signedIn={false} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
