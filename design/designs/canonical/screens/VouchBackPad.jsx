/* The first vouch — the stance pad, carrying its one-time onboarding. */
function PadLine({ children }) {
  return (
    <p style={{ margin: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}

function ReadoutRow({ label, size = 16 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
        <span aria-hidden="true" style={{ fontSize: size + 6, lineHeight: `${size + 10}px` }}>{"\u{1F642}"}</span>
        <span style={{ fontSize: "var(--text-body-small)", whiteSpace: "nowrap" }}>+0.10 / +0.10</span>
      </span>
    </div>
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
        </Card>
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <div style={{ position: "absolute", inset: 0, background: "var(--scrim-wash, rgba(0, 0, 0, 0.5))" }} />
      <div
        style={{
          position: "absolute",
          left: 30,
          right: 30,
          bottom: 80,
          borderRadius: "var(--radius-extra-large)",
          background: "var(--surface-container-high)",
          color: "var(--on-surface)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PadLine>{"\u{1F937}"} No stance on @mira yet.</PadLine>
            <ReadoutRow label="Your pick" size={16} />
          </div>
          <span
            style={{
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--border-strong, var(--outline))",
              color: "var(--text-secondary)",
              fontSize: "var(--text-label-small)",
              fontWeight: "var(--text-label-small--font-weight)",
              flex: "none",
            }}
          >
            ?
          </span>
        </div>
        <div style={{ alignSelf: "center" }}>
          <StancePad value={{ pDirected: 0.1, pInterest: 0.1 }} />
        </div>
        <PadLine>Your first stance. The pad is how you shape what reaches you — for or against, and how much.</PadLine>
        <PadLine>Later, press and hold the small face under a post to open this — a quick tap on it signs a gentle +0.10 / +0.10.</PadLine>
        <PadLine>Nothing is signed until Set. Prefer sliders or exact numbers? Swap the input in settings.</PadLine>
        <ReadoutRow label="Resulting stance" size={12} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text" size="sm">
            Cancel
          </Button>
          <Button size="sm">Set</Button>
        </div>
      </div>
    </>
  );
}
