/* The set-up ceremony's seal: publishing the payout address — the one signed
   act the wallet's birth carries (a parallel Registration). WizardHeader:
   arrow one step back, X leaves (nothing to keep yet — "Leave"). */
export function Screen() {
  return (
    <>
      <WizardHeader
        title="What you sign"
        leaveLabel="Leave"
        action={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Last step</span>
            <SystemHelpDot ariaLabel="Signed actions" />
          </span>
        }
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 16px 24px", overflow: "hidden" }}>
        <PayoutAddress
          address={SOL_ADDRESS}
          label="Your payout address"
          onCopy={() => {}}
          caption="Payouts and tips land here. It's public, and every change to it stays on your record."
        />

        <ActsCard rows={[{ label: "Address", value: "Your payout address", count: "1 action" }]} total="1 signed action" />

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button style={{ width: "100%" }}>Sign and publish</Button>
          <Button variant="text" style={{ width: "100%" }}>Back</Button>
        </div>
      </div>
    </>
  );
}
