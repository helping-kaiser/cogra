/* The wallet for an applicant (round 2: the return is UNMISSABLE): after
   approval there is one thing left to do here, and earnings cannot land
   until it's done. Same honest register as the applicant cards elsewhere. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <Card style={{ flex: "none" }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
            One thing left after approval
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Come back here once you're approved and create your payout address — one signed action.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
            Earnings can't land until it exists.
          </p>
        </Card>
        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
