/* The wallet for an applicant (round 3: the brand wash — the page they'll
   return to deserves to look like itself already — and the return is
   UNMISSABLE): after approval there is one thing left to do here, and
   earnings cannot land until it's done. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WashCard>
          <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
            One thing left after approval
          </h2>
          <p style={{ margin: 0, position: "relative", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Come back here once you're approved and create your payout address — one signed action.
          </p>
          <p style={{ margin: 0, position: "relative", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
            Earnings can't land until it exists.
          </p>
        </WashCard>
        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
