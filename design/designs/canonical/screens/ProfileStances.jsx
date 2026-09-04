/* The stances page (profile round, item 23 — jakob: "kinda similar to the way
   insta handles their followers/following page"). Opened from any profile's
   figures row: two text tabs, both directions SEPARATED — never one merged
   list — and each row is a person with the public stance the row is about,
   its face and pair drawn plainly (every stance is a public record). Tapping
   the person opens their profile. A read drill-in: back arrow, bar rides.

   THE TAB ROW IS `TabBar` WITH WORDS. Two directions is a choice made in
   words, not glyphs — and a cell whose own words are its name takes no
   aria-label, which the master derives from the tab rather than a prop. */
export function Screen() {
  return (
    <>
      <PageHeader title="@ada · Stances" backHref="#" backLabel="Back" />
      <TabBar
        ariaLabel="Which direction"
        value="on"
        tabs={[
          { id: "on", label: "On them" },
          { id: "taken", label: "They've taken" },
        ]}
      />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", paddingTop: 4 }}>
        <StanceRow name="Tobias Lindqvist" handle="tobias" pDirected={0.7} pInterest={0.4} />
        <StanceRow name="Sol Ferreira" handle="sol" pDirected={0.6} pInterest={0.3} />
        <StanceRow name="Mira Voss" handle="mira" src="inviter.jpg" pDirected={0.4} pInterest={0.5} />
        <StanceRow name="Juno Baptiste" handle="juno" pDirected={-0.2} pInterest={0.1} />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
