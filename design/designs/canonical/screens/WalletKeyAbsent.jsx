/* The wallet on a device without the keys (restore-first, the key-absence
   pattern): the balance and history stay readable — the address is public
   and the chain is public — but nothing signs. The tertiary notice is the
   same one the seal wears, with the platform noun ("this browser"). */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WalletBalance amount={128.4} approx="0.00087" onHelp={() => {}} />

        <div style={{ padding: "8px 16px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: "var(--radius-medium)", background: "var(--tertiary-container)", color: "var(--on-tertiary-container)", padding: 16 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-title-small, 16px)", lineHeight: "24px", fontWeight: 500 }}>
              Your key isn't on this browser
            </h2>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
              Your balance stays readable — it's public, like the address it sits at. Changing the address needs your key.
            </p>
            {/* The notice's own CTA colours, as the key-absent seal draws it. */}
            <Button style={{ width: "100%", background: "var(--on-tertiary-container)", color: "var(--tertiary-container)" }}>Restore the key</Button>
          </div>
        </div>

        <SectionLabel>History</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", padding: "0 24px" }}>
          <LedgerRow words='Payout · "Sunday at the tide market"' when="2d" amount={12.4} onOpen={() => {}} />
          <LedgerRow words="Tip from @tobias" when="4d" amount={2} onOpen={() => {}} />
        </div>

        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
