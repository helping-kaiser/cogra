/* Landed — approved, and the vouch-back opens the way.

   THE BORROWED VIEW ENDS ON ANY FIRST OPINION (jakob 2026-10-02, C13 revised:
   their own graph exists, so their own feed exists). The landed member's
   first signed opinion — on @mira, on a post, on anyone — ends the band and
   hands the feed over to their own vantage. The vouch-back is not the gate:
   a member may opine on whoever they please and never vouch back at all. So
   the band names the view and asks for nothing — no `Vouch back` word rides
   it — and its line says what ends the borrowing.

   THE CARD PUTS AWAY FOR GOOD, SILENTLY. `Not now` is a true dismiss: the
   card does not come back and nothing stands in its place — no snackbar, no
   reminder, no residue. Vouching back stays possible forever, from @mira's
   profile: ANY OPINION ON @mira IS THE VOUCH-BACK while the pair is
   incomplete, wherever it is signed — this card or her profile's anchor, the
   card put away or not — and it opens `VouchedIn`.

   THE CARD WEARS THE OLIVE REGISTER (the olive split: it asks the reader to
   act), drawn once as `VouchBackCard` in `_shared.jsx` and shared with the
   pad's board. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand
          handle="mira"
          displayName="Mira Voss"
          avatarSrc="inviter.jpg"
          line="Browsing from @mira's view — your first opinion starts your own."
        />
      </CograBand>
      <FeedList>
        <VouchBackCard
          body="Vouch back to open the way from your side — your first opinion, and your feed grows from it. Vouching opens the opinion control, set to a gentle default."
          actions={
            <>
              <Button variant="text" style={{ color: "var(--on-tertiary-container)" }}>
                Not now
              </Button>
              <Button variant="inverse">Vouch back</Button>
            </>
          }
        />
        <PostCard {...ADA_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
