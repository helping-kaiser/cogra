/* THE SAME SCREEN, FOR A POST WHOSE PATHS HAVE ALL AGED OUT (backlog item 13's
   second open question; jakob ruled it a quiet line in the graph register).

   WHEN IT HAPPENS, exactly: only the terminal step of a path decays
   (`feed-ranking.md` §5.3), so a post that once arrived over a dozen routes
   keeps every relationship behind them and loses only the freshness of the last
   opinion on each. Once those are old enough, every path's contribution falls
   under the dust floor and the extraction returns none (§6.3). The post is still
   readable, still connected, and reaches nobody through the graph — it rides the
   feed's newest-first tail instead.

   IT IS NOT AN EMPTY LIST, SO IT IS NOT `EmptyState`. That master says "nothing
   here yet" and offers the one action that fills it; here something WAS here,
   nothing is owed, and there is nothing the reader could do about it. A quiet
   line under the cover is the honest shape — and the shape jakob ruled.

   IT REACHES THE SCREEN AS CONTENT, NOT AS A TAP. The score opens this same
   board in the state an aged-out post leaves it, exactly as `TagPageEmpty` is
   the page any chip opens for a name nobody has used. */
export function Screen() {
  return (
    <>
      <PageHeader title="Why this reached you" backHref="#" backLabel="Back to the post" />
      <ScoreColumn>
        {/* The score is a real 0.00 and not a dash: the sum of no paths is
            nothing, and the product's one number format says so. A dash is for a
            figure that has not been computed yet — the post still settling. */}
        <ScoreOrigin score="0.00" />
        <QuietNote>The paths that carried it here have moved on.</QuietNote>
      </ScoreColumn>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
