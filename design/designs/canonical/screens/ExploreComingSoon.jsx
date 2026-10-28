/* EXPLORE · NOT HERE YET — what the bottom bar's Explore slot opens while
   search has not shipped (seam 245, ask 12, under jakob's autonomy order of
   2026-10-28: drawn as cheap insurance, Explore itself being slice 2.7's work
   in the same run; the moment `Explore` ships, this board is retired and the
   slot opens Explore's root as `Explore` draws it).

   IT IS `WalletComingSoon`'S SIBLING, AND NOTHING ELSE. The slot keeps its
   place, so the tap needs somewhere to land; the door is a tab root, drawn as
   one — the band with chats and the bell, the bar with the Explore slot
   selected, no back arrow — and it wears the coming-soon card: the thing, an
   em dash, `coming soon` as the headline, and one sentence of what will be
   here (copy-voice, *The coming-soon surfaces*). One face for every reader
   state, guest included, and no action: nothing a reader can do fills it yet.

   THE LINE NAMES WHAT THE TAB HOLDS, NOT A FEATURE LIST. Explore's root is
   the search field first, so `Search will be here.` is the sentence of what
   will be there, in the doors' shape — no date, no "next" (drafted 2026-10-28,
   the wording jakob's at review). The Sky's own card stays Explore's, not the
   door's: the door stands in for the tab, the Sky for one thing on it. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <ComingSoonCard thing="Explore" line="Search will be here." />
        <div style={{ flex: 1 }} />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
