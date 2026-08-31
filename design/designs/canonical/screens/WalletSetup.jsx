/* The wallet's set-up moment (item 12; docs: ledger.md "Keys"): the rail key
   is born HERE, lazily at first wallet open — the join ceremony was ceremony
   enough. No new recovery code: the key joins the one container under the
   one code. The ceremony's single signed act is publishing the payout
   address — the seal board beside this one. The "?" is copy-voice's "Your
   wallet key". */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <Card style={{ flex: "none" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
              Set up your wallet
            </h2>
            <SystemHelpDot ariaLabel="Your wallet key" />
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Your wallet gets its own key, made on this device and restored by the recovery code you already have.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Publishing your payout address is one signed action — payouts and tips land there.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="sm">Create and publish</Button>
          </div>
        </Card>
        <p style={{ margin: 0, padding: "8px 24px 0", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
          Nothing is created until you continue.
        </p>
        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
