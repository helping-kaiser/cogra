/* The wallet at rest (item 12 round 2 — direction A, jakob 2026-08-31): the
   balance as a trophy on the brand wash, the earnings bars beneath it, the
   history as identity rows, the campaign as ONE entry row into its own
   subpage (WalletCampaign), and the address in its card. This page is the
   user's reach paying off — it should feel like it. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WalletBalance amount={128.4} approx="0.00087" delta="+14.40 this week" onHelp={() => {}} />

        <div style={{ height: 12, flex: "none" }} />
        <EarnedChart
          height={48}
          caption="Earned · last 8 settlements"
          points={[
            { amount: 2.1 },
            { amount: 4.6 },
            { amount: 0 },
            { amount: 3.2 },
            { amount: 7.9 },
            { amount: 5.4 },
            { amount: 9.8 },
            { amount: 12.4, label: 'Settlement of "Sunday at the tide market" — 12.40', onOpen: () => {} },
          ]}
        />

        <SectionLabel>History</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          <LedgerRow words="Payout · settling" context="Campaign settlement underway" amount={3.1} pending glyph="campaign" />
          <LedgerRow words='Payout · "Sunday at the tide market"' context="Campaign settled" when="2d" amount={12.4} image="gallery-market.jpg" onOpen={() => {}} />
          <LedgerRow words="Tip from @tobias" context='On "Salt maps of the coast road"' when="4d" amount={2} name="Tobias Lindqvist" onOpen={() => {}} />
        </div>

        <SectionLabel>Your campaign</SectionLabel>
        <div style={{ padding: "0 16px" }}>
          <LedgerRow
            words='"Sunday at the tide market"'
            context="In escrow · settles in 6 days"
            amount={-12500}
            glyph="campaign"
            onOpen={() => {}}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Compact here — the public-record caption lives on the zero state
            and the seals; the rest-state wallet keeps the card lean. */}
        <div style={{ padding: "0 16px 8px" }}>
          <PayoutAddress address={SOL_ADDRESS} onCopy={() => {}} onChange={() => {}} />
        </div>
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
