/* The Explore tab at rest (readme §13, the search rulings; hybrid of the
   ideation's directions 1 + 2): the search field under the brand band, THE SKY
   as the hero card — item 16's future 3D view, never a small side thing — and
   the device-local recents below. Typing drops the hero off the bottom edge
   and the searching view takes the screen.

   AND THE DOOR INTO YOUR TOPICS (the topic round, 2026-09-14). It is a DOOR,
   not a section, and the list is a subpage: the held set has no bound — a
   reader may hold three topics or thirty — and a list of unknown length inlined
   here would push the recents under the fold and turn the tab into a list page.
   The tab's job is to find something; what you already hold is a destination.
   The feed filter needs it to BE one as well: its topic narrowing carries a way
   to the full list, and a door needs somewhere to lead.

   IT SITS BETWEEN THE HERO AND THE RECENTS, which is the page's own order —
   the Sky is everyone's graph, Your topics is the reader's own shelf, Recent
   is the device's scratch. `ContentRow`'s `door` variant is the master for
   exactly this (the wallet's Campaigns row), and its disc carries the `#` every
   topic in this system wears, because no icon set has a topic glyph and §5
   forbids drawing one.

   THE SECOND LINE COUNTS WHAT IS BEHIND THE DOOR, and the count is the list's
   length — `RefsSheet`'s discipline, because the subpage is the only place that
   number can be checked. */
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
            <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>The Sky</h2>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
              Your sky — every account a star, sized by your own paths to it.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button size="sm">Enter the Sky</Button>
            </div>
          </Card>
        </div>
        <div style={{ padding: "0 var(--space-6) var(--space-2)" }}>
          <ContentRow variant="door" title="Your topics" second="5 held" letter="#" onOpen={() => {}} />
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
