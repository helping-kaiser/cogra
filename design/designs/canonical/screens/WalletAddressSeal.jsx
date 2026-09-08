/* The set-up ceremony's seal: publishing the payout address — the one signed
   act the wallet's birth carries (a parallel Registration). WizardHeader:
   arrow one step back, X leaves (nothing to keep yet — "Leave"). */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="Leave" stageLabel="Last step" help="Signed actions" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 16px 24px", overflow: "hidden" }}>
        <PayoutAddress
          address={SOL_ADDRESS}
          label="Your payout address"
          onCopy={() => {}}
          caption="Payouts and tips land here. It's public, and every change to it stays on your record."
        />

        <ActsCard rows={[{ label: "Address", value: "Your payout address", count: "1 action" }]} total="1 signed action" />

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign and publish" />
      </div>
    </>
  );
}
