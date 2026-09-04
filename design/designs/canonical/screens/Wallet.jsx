/* The wallet at rest (item 12 round 3): hero, the ONE-LINE address row (an
   entry point near the top — the full card with copy and Change is one tap
   away, out of scrolling's way), the earned bars, the CAMPAIGNS DOORWAY (the
   campaigns page owns creating and managing; here the wallet keeps only the
   door), and the history — where campaign money now lives as ordinary
   entries: escrow out, top-up out, return in.

   THE DOOR IS `ContentRow`'s `door` variant — the same row the history below
   it draws, with the filled disc that says entrance rather than entry. */

export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WalletBalance amount={128.4} approx="0.00087" delta="+14.40 this week" onHelp={() => {}} />

        <div style={{ padding: "8px 16px 0" }}>
          <PayoutAddressRow address={SOL_ADDRESS} onOpen={() => {}} />
        </div>

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

        <div style={{ padding: "12px 16px 0" }}>
          <ContentRow variant="door" title="Campaigns" second="1 open · start a new one" glyph="campaign" onOpen={() => {}} />
        </div>

        <SectionLabel>History</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          <LedgerRow words="Payout · settling" context="Campaign settlement underway" amount={3.1} pending glyph="campaign" />
          <LedgerRow words='Payout · "Sunday at the tide market"' context="Campaign settled" when="2d" amount={12.4} image="gallery-market.jpg" onOpen={() => {}} />
          <LedgerRow words='Campaign return · "Postcard run"' context="Unspent deposit came back" when="3d" amount={1730} glyph="campaign" onOpen={() => {}} />
          <LedgerRow words="Tip from @tobias" context='On "Salt maps of the coast road"' when="4d" amount={2} name="Tobias Lindqvist" onOpen={() => {}} />
        </div>

        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
