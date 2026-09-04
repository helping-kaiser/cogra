/* Changing the payout address (jakob's ruling 8): a seal flow inside the
   wallet — a parallel Registration, newest wins, every prior state
   witnessed. Both addresses shown whole; the history line said plainly. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" help="Signed actions" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 16px 24px", overflow: "hidden" }}>
        <PayoutAddress address={SOL_ADDRESS} label="Current" />
        <PayoutAddress
          address={SOL_ADDRESS_NEW}
          label="New"
          onCopy={() => {}}
          caption="New payouts and tips land here. Every earlier address stays on your public record."
        />

        <ActsCard rows={[{ label: "Address", value: "A new payout address", count: "1 action" }]} total="1 signed action" />

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign the change" />
      </div>
    </>
  );
}
