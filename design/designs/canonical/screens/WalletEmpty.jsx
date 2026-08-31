/* The wallet at zero — a new member after set-up: the hero still wears the
   wash (the trophy shelf is there, waiting), the figure is the true "0", no
   ≈ line (nothing to price). The empty words are PATH-TRUE (jakob's round-2
   correction): earnings come from campaigns when the paths between an
   advertiser's crowd and their target run through you — posting alone is
   how paths start, not a guarantee. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WalletBalance amount={0} onHelp={() => {}} />

        {/* The full card sits high here — a new member's first move is
            checking this against their wallet; at rest it collapses to the
            one-line row. */}
        <div style={{ padding: "8px 16px 0" }}>
          <PayoutAddress
            address={SOL_ADDRESS}
            onCopy={() => {}}
            onChange={() => {}}
            caption="The address is public — and so is every change to it."
          />
        </div>

        <SectionLabel>History</SectionLabel>
        <div style={{ flex: "none", padding: "4px 24px 0" }}>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Nothing here yet. Earnings come from campaigns — paid when the paths between an advertiser's crowd and their target run through you.
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Posting, connecting, and taking stances is how paths start running through you. Tips land the moment someone sends one.
          </p>
        </div>

        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
