/* The wallet at zero — a new member after set-up: the true state, plainly
   (readme §13, Money figures: zero renders "0", never 0.00). No ≈ line —
   nothing to price. The empty history says how money starts arriving. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WalletBalance amount={0} onHelp={() => {}} />

        <SectionLabel>History</SectionLabel>
        <div style={{ flex: "none", padding: "8px 24px 0" }}>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Nothing here yet — earnings land as your posts and stances reach people, and tips land the moment someone sends one.
          </p>
        </div>

        <div style={{ flex: 1 }} />

        <SectionLabel>Payouts land at</SectionLabel>
        <div style={{ padding: "0 24px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
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
