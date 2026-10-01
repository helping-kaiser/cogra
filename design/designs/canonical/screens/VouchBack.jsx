/* Landed — approved, and the vouch-back opens the way.

   THE BAND CARRIES `Vouch back` WHILE THE PAIR IS INCOMPLETE (the vouch-back
   later ruling, jakob 2026-10-01). `Not now` puts the card away on this device
   only — another device shows it again, legitimately — and the band, which
   says "vouch back to start your own" for as long as the view is borrowed,
   keeps the way to the pad so the line never asks for an act it cannot
   reach. Both buttons open the same pad, so they share one flow number.

   ANY FIRST OPINION ON @mira IS THE VOUCH-BACK, wherever it is signed: from
   this card, from the band, or from her profile's anchor. It ends
   the borrowed view and opens `VouchedIn`. An opinion on anything else does
   neither — the view stays borrowed until the vouch-back itself lands. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand
          handle="mira"
          displayName="Mira Voss"
          avatarSrc="inviter.jpg"
          line="Browsing from @mira's view — vouch back to start your own."
          actionLabel="Vouch back"
          onAction={() => {}}
        />
      </CograBand>
      <FeedList>
        <Card style={{ flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MonogramAvatar name="Mira Voss" src="inviter.jpg" size="lg" />
            <h2
              style={{
                margin: 0,
                fontSize: "var(--text-title-medium)",
                lineHeight: "var(--text-title-medium--line-height)",
                fontWeight: "var(--text-title-medium--font-weight)",
              }}
            >
              @mira vouched you in
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Vouch back to open the way from your side — your first opinion, and your feed grows from it. Vouching opens the opinion control, set to a gentle default.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text">Not now</Button>
            <Button>Vouch back</Button>
          </div>
        </Card>
        <PostCard {...ADA_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
