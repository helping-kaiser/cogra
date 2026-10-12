/* WHY THIS REACHED YOU — level one of the Feed score's drill-down (backlog item
   13, ruled by jakob 2026-09-11). The score on a card or a detail surface opens
   it, and it answers the one question a ranked feed owes its reader: why is this
   post in MY feed, and not somebody else's.

   THE ANSWER IS THE PATHS, NOT A BREAKDOWN. `feed-ranking.md` §6.1: the score is
   the sum of up to `k` internally disjoint paths from the viewer's own outgoing
   opinions to the post, strongest first — so the honest first screen is that
   list, in that order, with each path stating what it adds. There is no chart
   here and there will not be one: a bar would turn a reader's own connections
   into a statistic about the post.

   THE STRONGEST HANDFUL, THEN A ROW THAT EXPANDS (jakob's ruling). Four paths
   are drawn and the two weakest ride one quiet row; tapping it unfolds them in
   place. Never a second page — a reader chasing one number should not have to
   hold a page number while they do it.

   THE MORE-PATHS ROW CARRIES WHAT THEY ADD, which is this surface's whole
   obligation: 6.80 + 4.20 + 2.60 + 1.10 + 0.50 is 15.20, and a reader who adds
   the drawn rows must land on the number they tapped. A row that said only "2
   more paths" would leave a 0.50 hole in the one place the product promises
   there is none.

   EVERY PATH STARTS WITH AN OPINION THE READER GAVE (§1, the inbound-inert
   rule): nothing anyone points at you moves anything toward you. That is the
   note under the cover, and it is the sentence the whole feature exists to make
   checkable.

   UNDER A BORROWED VIEW IT IS SAID IN THE THIRD PERSON (jakob 2026-10-12,
   SR-G3; the `view` chip's `borrowed`). A guest or an applicant reads a feed
   walked from someone else's opinions, so "an opinion you gave" would be false
   for them: the note names the account the view is borrowed from, in the
   band's own grammar (`Browsing from @mira's view`), and every path leads with
   that account's face. */
export const PROPS = { view: { editor: "enum", options: ["own", "borrowed"], default: "own" } };
export const VALS = `traceNote: this.props.view === "borrowed" ? "Every path here starts with an opinion @mira gave." : "Every path here starts with an opinion you gave.", ownPaths: this.props.view === "borrowed" ? "none" : "contents", borrowedPaths: this.props.view === "borrowed" ? "contents" : "none"`;
export function Screen() {
  return (
    <>
      <PageHeader title="Why this reached you" backHref="#" backLabel="Back to feed" />
      <ScoreColumn>
        <ScoreOrigin />
        <QuietNote>{"{{traceNote}}"}</QuietNote>

        <SectionLabel>Strongest first</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "{{ownPaths}}" }}>
            {SCORE_PATHS.map((path) => (
              <PathRow key={path.through} people={path.people} through={path.through} value={path.value} onOpen={() => {}} />
            ))}
          </div>
          <div style={{ display: "{{borrowedPaths}}" }}>
            {SCORE_PATHS_BORROWED.map((path) => (
              <PathRow key={path.through} people={path.people} through={path.through} value={path.value} onOpen={() => {}} />
            ))}
          </div>

          {/* The quiet row. It is a text control and not a card: the four above
              it are destinations and this one is a state change on this screen,
              so it must not look like a fifth path. */}
          <button
            type="button"
            className="cg-state cg-focus cg-hit"
            aria-label={`Show ${SCORE_MORE_PATHS.count} more paths`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              width: "100%",
              minHeight: "var(--touch-target-min)",
              border: 0,
              background: "none",
              padding: "0 var(--space-3)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              color: "var(--text-secondary)",
              textAlign: "left",
              boxSizing: "border-box",
            }}
          >
            <span aria-hidden="true" style={{ flex: 1 }}>{SCORE_MORE_PATHS.count} more paths</span>
            <span aria-hidden="true" style={{ flex: "none", color: "var(--on-surface)", fontSize: "var(--text-body-small)", fontWeight: 500 }}>
              {SCORE_MORE_PATHS.value}
            </span>
          </button>
        </div>
      </ScoreColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
