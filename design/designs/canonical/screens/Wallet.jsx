/* The wallet at rest (item 12, jakob's rulings 2026-08-31): the balance
   headline with the market ≈, one history stream newest first (a pending
   payout wearing Still settling — the pending look item 11 deferred here),
   the member's own campaign as a money view, and the witnessed payout
   address. No free-form send (tipping IS the send), no cash-out — moving
   CGT elsewhere is any Liquid tool's job, and the wallet says where the
   money lives, not where to sell it. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WalletBalance amount={128.4} approx="0.00087" onHelp={() => {}} />

        <SectionLabel>History</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", padding: "0 24px" }}>
          <LedgerRow words="Payout · settling" amount={3.1} pending />
          <LedgerRow words='Payout · "Sunday at the tide market"' when="2d" amount={12.4} onOpen={() => {}} />
          <LedgerRow words="Tip from @tobias" when="4d" amount={2} onOpen={() => {}} />
          <LedgerRow words="Tip to @ada" when="5d" amount={-2} onOpen={() => {}} />
          <LedgerRow words='Payout · "The long way home"' when="8d" amount={0.0003} onOpen={() => {}} />
        </div>

        <SectionLabel>Your campaign</SectionLabel>
        <div style={{ padding: "0 16px" }}>
          <Card style={{ flex: "none" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
                Sunday at the tide market
              </span>
              <span style={{ flex: "none", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
                <MoneyFigure amount={12500} />
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
              In escrow · runs 6 more days · settles as one public record
            </p>
          </Card>
        </div>

        <SectionLabel>Payouts land at</SectionLabel>
        <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 4 }}>
          <PayoutAddress address={SOL_ADDRESS} label="" onChange={() => {}} />
          <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
            The address is public — and so is every change to it.
          </p>
        </div>
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
