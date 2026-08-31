/* The wallet for a guest (round 2: reworded, prompt centered): what CGT is
   for in one honest breath, and the standard join prompt — centered, not
   left-bound. Nothing pretends a wallet exists. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <Card style={{ flex: "none" }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
            The wallet
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            CGT is how CoGra pays its people — for the reach their posts and stances actually deliver, held by their own key, never by CoGra.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Join, and what you grow here lands here.
          </p>
        </Card>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "center", padding: "0 16px 8px" }}>
          <JoinPrompt inline />
        </div>
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
