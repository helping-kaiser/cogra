/* Landed — approved, and the first stance (the vouch-back) opens the way. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" line="Browsing from @mira's view — vouch back to start your own." />
      </CograBand>
      <FeedList>
        <Card style={{ flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MonogramAvatar name="Mira Voss" src="inviter.jpg" size="lg" />
            <h2
              style={{
                margin: 0,
                fontSize: "var(--text-title-medium)",
                lineHeight: "var(--text-title-medium--line-height)",
                fontWeight: "var(--text-title-medium--font-weight)",
              }}
            >
              @mira vouched you in
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            Vouch back to open the way from your side — your first stance, and your feed grows from it. Vouching opens the stance control, set to a gentle default.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text">Not now</Button>
            <Button>Vouch back</Button>
          </div>
        </Card>
        <PostCard {...ADA_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
