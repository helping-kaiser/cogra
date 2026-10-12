/* THE SAME SCREEN, WITH NO PATHS TO LIST (backlog item 13's second open
   question, a quiet line in the graph register; its trigger and its figure
   ruled by jakob 2026-10-12, item 12).

   WHEN IT HAPPENS, exactly: a score is the figure the reader's OWN LAST FEED
   FETCH computed, and the score's tap is the only fetch of one thing's
   standing — the trace has to fetch the paths it lists. When that fetch finds
   none, this is what stands. Nothing is checked in the background, and an
   epoch ending changes nothing on screen.

   THE FIGURE READS THE DASH: no computed figure, the same glyph the feed card
   and the stream's rail then wear. Never 0.00 — zero is severance's alone, and
   the drill-down never has to explain one. Back on the feed the card's and the
   rail's score read the dash too, the door still standing, and the old figure
   never shows again; the next feed fetch dissolves the state.

   IT IS NOT AN EMPTY LIST, SO IT IS NOT `EmptyState`. That master says "nothing
   here yet" and offers the one action that fills it; here something WAS here,
   nothing is owed, and there is nothing the reader could do about it. A quiet
   line under the cover is the honest shape — and the shape jakob ruled.

   THE `cause` CHIP'S `settling` (SR-G2, the slice-3 round): a thing still
   settling has no figure by construction and no paths yet, so its trace is the
   same shape — the cover, the dash, one quiet line saying the paths count once
   it lands. No fetch is made for it.

   IT REACHES THE SCREEN AS CONTENT, NOT AS A TAP. The score opens this same
   board in the state the fetch leaves it, exactly as `TagPageEmpty` is the page
   any chip opens for a name nobody has used. */
export const PROPS = { cause: { editor: "enum", options: ["moved", "settling"], default: "moved" } };
export const VALS = `traceLine: this.props.cause === "settling" ? "Still settling — its paths count once it lands." : "The paths that carried it here have moved on."`;

export function Screen() {
  return (
    <>
      <PageHeader title="Why this reached you" backHref="#" backLabel="Back to feed" />
      <ScoreColumn>
        <ScoreOrigin score="—" />
        <QuietNote>{"{{traceLine}}"}</QuietNote>
      </ScoreColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
