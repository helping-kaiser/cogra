/* The wallet for a guest: the tab exists and answers honestly — what CGT is
   for, and that earning takes membership. The join prompt is the standard
   one; nothing here pretends a wallet exists. */
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
            CGT pays the people whose posts and stances carry real reach — held by their own key, never by CoGra.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            You're browsing as a guest — sign in or join to earn and tip.
          </p>
        </Card>
        <div style={{ flex: 1 }} />
        <JoinPrompt inline />
      </div>
      <BottomNav active="wallet" slots={ALL_SLOTS} inline />
    </>
  );
}
