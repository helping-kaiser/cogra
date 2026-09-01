/* The stances page (profile round, item 23 — jakob: "kinda similar to the way
   insta handles their followers/following page"). Opened from any profile's
   figures row: two text tabs, both directions SEPARATED — never one merged
   list — and each row is a person with the public stance the row is about,
   its face and pair drawn plainly (every stance is a public record). Tapping
   the person opens their profile. A read drill-in: back arrow, bar rides. */
function StanceTabs({ value = "on" }) {
  const TABS = [
    { id: "on", label: "On them" },
    { id: "taken", label: "They've taken" },
  ];
  return (
    <div role="group" aria-label="Which direction" style={{ display: "flex", borderBottom: "1px solid var(--border-hairline)" }}>
      {TABS.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={selected}
            className="cg-state cg-focus"
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              minHeight: "var(--touch-target-min)",
              border: 0,
              background: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-label-large)",
              fontWeight: "var(--text-label-large--font-weight)",
              letterSpacing: "var(--text-label-large--letter-spacing)",
              color: selected ? "var(--primary)" : "var(--text-secondary)",
              boxShadow: selected ? "inset 0 -2px 0 var(--primary)" : "none",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function Screen() {
  return (
    <>
      <PageHeader title="@ada · Stances" backHref="#" backLabel="Back" />
      <StanceTabs value="on" />
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
