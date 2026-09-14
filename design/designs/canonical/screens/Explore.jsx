/* The Explore tab at rest (readme §13, the search rulings; hybrid of the
   ideation's directions 1 + 2): the search field under the brand band, THE SKY
   as the hero card — item 16's future 3D view, never a small side thing — and
   the device-local recents below. Typing drops the hero off the bottom edge
   and the searching view takes the screen.

   THE HERO ANNOUNCES; IT IS NOT A DOOR (jakob's ruling 2026-09-14). The Sky is
   drawn after the MVP, so the card that would open it holds the door's place
   and says so. The CTA is gone and the heading carries the state — a button
   that leads nowhere is the one thing the staging rule refuses, and a reader
   who presses it learns only that the build is broken.

   THE CARD STAYS, and that is the point of the ruling. Pulling the hero until
   the Sky exists would rebuild Explore's whole first screen twice: the recents
   would rise into the space, and they would drop back out of it later. The
   drawing already says the Sky is the tab's biggest idea; an empty promise is
   worse than a kept space, and the space is what keeps the promise.

   IT IS THE `ChatsComingSoon` PRECEDENT AS A CARD, NOT A SCREEN. Chats had an
   icon whose tap needed somewhere to land, so the tap got a board; the Sky's
   affordance sits inside a card that already says what the Sky is, so the card
   answers in place and nothing is routed to. The graph's gap closes with the
   door: an announcement owes no design. */
export function Screen() {
  return (
    <>
      <CograBand>
        <SearchBar query="" placeholder="Search people, posts, tags…" />
      </CograBand>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 0 8px 0" }}>
          <Card style={{ flex: "none" }}>
            <div style={{ margin: "0 calc(-1 * var(--card-padding))", marginTop: "calc(-1 * var(--card-padding))" }}>
              <SkyField height={180} />
            </div>
            <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>The Sky — coming soon</h2>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
              Your sky — every account a star, sized by your own paths to it.
            </p>
          </Card>
        </div>
        <SectionLabel>Recent</SectionLabel>
        <RecentRow text="@sol salt" />
        <RecentRow text="#saltmaps" />
        <RecentRow text="coast road" />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
