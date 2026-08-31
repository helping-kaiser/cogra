/* The wallet for a guest (round 3: the brand wash, not a settings register —
   this is the money side's front door for someone deciding whether to join).
   The join prompt stays the standard one, centered. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WashCard>
          <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
            The wallet
          </h2>
          <p style={{ margin: 0, position: "relative", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            CGT is how CoGra pays its people — for the reach their posts and stances actually deliver, held by their own key, never by CoGra.
          </p>
          <p style={{ margin: 0, position: "relative", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Join, and what you grow here lands here.
          </p>
        </WashCard>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "center", padding: "0 16px 8px" }}>
          <JoinPrompt inline />
        </div>
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
