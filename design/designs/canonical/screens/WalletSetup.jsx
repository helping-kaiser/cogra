/* The wallet's set-up moment (round 3: this is a person's FIRST look at a
   page that will matter to them — it wears the brand wash, not a settings
   register). The rail key is born here, lazily (ledger.md "Keys"): no new
   recovery code, the key joins the one container under the one code, and
   the ceremony's single signed act is publishing the payout address. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WashCard>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
              Set up your wallet
            </h2>
            <SystemHelpDot ariaLabel="Your wallet key" />
          </div>
          <p style={{ margin: 0, position: "relative", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            This is where your reach pays off — payouts and tips, held by your own key, never by CoGra.
          </p>
          <p style={{ margin: 0, position: "relative", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            The key is made on this device and restored by the recovery code you already have. Publishing your payout address is one signed action.
          </p>
          <div style={{ position: "relative", display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
            <Button>Create and publish</Button>
          </div>
        </WashCard>
        <p style={{ margin: 0, padding: "8px 24px 0", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Nothing is created until you continue.
        </p>
        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
