/* The wallet for an applicant: honest about the order of things — the
   wallet's rail side begins with membership (the rail key is born at first
   wallet open, after landing), so there is nothing to show yet and nothing
   is locked away either. Same register as the applicant cards elsewhere. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <Card style={{ flex: "none" }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
            Your wallet opens with your membership
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Earnings start once your application is approved and your registration lands. Set-up takes one signed action, right here.
          </p>
        </Card>
        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
