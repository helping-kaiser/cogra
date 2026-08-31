/* Changing the payout address (jakob's ruling 8): a seal flow inside the
   wallet — a parallel Registration, newest wins, every prior state
   witnessed. Both addresses shown whole; the history line said plainly. */
export function Screen() {
  return (
    <>
      <WizardHeader
        title="What you sign"
        action={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Last step</span>
            <SystemHelpDot ariaLabel="Signed actions" />
          </span>
        }
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <PayoutAddress address={SOL_ADDRESS} label="Current" />
        <PayoutAddress address={SOL_ADDRESS_NEW} label="New" />

        <ActsCard rows={[{ label: "Address", value: "A new payout address", count: "1 action" }]} total="1 signed action" />

        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          New payouts and tips land at the new address. Every earlier address stays on your public record.
        </p>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button style={{ width: "100%" }}>Sign the change</Button>
          <Button variant="text" style={{ width: "100%" }}>Back</Button>
        </div>
      </div>
    </>
  );
}
