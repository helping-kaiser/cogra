/* The wallet on a device without the keys (restore-first): the key notice
   LEADS — it is the odd one out and must not split the wallet's own parts
   (jakob's round-2 correction) — inset to the same margins as every card.
   Beneath it the wallet stays honestly readable: balance and history are
   public; only signing needs the key.

   THE RESTORE BUTTON IS `Button`'s `inverse` — the filled button standing on
   a tonal panel, taking the panel's own pair turned over rather than a
   `primary` fill arguing with it. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: "var(--radius-large)", background: "var(--tertiary-container)", color: "var(--on-tertiary-container)", padding: 16 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
              Your key isn't on this browser
            </h2>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
              Everything below stays readable — it's public, like the address it sits at. Changing the address needs your key.
            </p>
            <Button variant="inverse" style={{ width: "100%" }}>Restore the key</Button>
          </div>
        </div>

        <WalletBalance amount={128.4} approx="0.00087" onHelp={() => {}} />

        <SectionLabel>History</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          <LedgerRow words='Payout · "Sunday at the tide market"' context="Campaign settled" when="2d" amount={12.4} image="gallery-market.jpg" onOpen={() => {}} />
          <LedgerRow words="Tip from @tobias" context='On "Salt maps of the coast road"' when="4d" amount={2} name="Tobias Lindqvist" onOpen={() => {}} />
        </div>

        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
