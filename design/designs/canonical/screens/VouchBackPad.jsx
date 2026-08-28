/* The first vouch — the MASTER pad, parked open over the vouch card. The card,
   its readouts, the "?" and the buttons are all StanceControl's own anatomy;
   this screen contributes only the one-time coaching lines (`padNote`) and the
   wash. */
function PadLine({ children }) {
  return (
    <p style={{ margin: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}

export function Screen() {
  return (
    <>
      <CograBand>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" line="Browsing from @mira's view — vouch back to start your own." />
      </CograBand>
      <FeedList>
        <Card style={{ flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MonogramAvatar name="Mira Voss" src="inviter.jpg" size="lg" />
            <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>@mira vouched you in</h2>
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Vouch back to open the way from your side — your first stance, and your feed grows from it.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text">Not now</Button>
            <StanceControl
              targetLabel="@mira"
              defaultOpen
              defaultPick={{ pDirected: 0.1, pInterest: 0.1 }}
              padInset={80}
              padNote={
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <PadLine>Your first stance. The pad is how you shape what reaches you — for or against, and how much.</PadLine>
                  <PadLine>Later, press and hold the small face under a post to open this — a quick tap on it signs a gentle +0.10 / +0.10.</PadLine>
                  <PadLine>Nothing is signed until Set. Prefer sliders or exact numbers? Swap the input in settings.</PadLine>
                </div>
              }
            />
          </div>
        </Card>
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays sharp. */}
      <div style={{ position: "absolute", inset: 0, background: "var(--scrim-wash, rgba(0, 0, 0, 0.5))" }} />
    </>
  );
}
