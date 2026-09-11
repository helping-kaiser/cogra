/* ONE STEP — level three of the Post score's drill-down (backlog item 13). A
   step row on `RankPath` opens it, and it answers the question a folded step
   raises the moment a reader sees it: one face stands there, and the row under
   it said two opinions. Which two, and why do they read as one?

   THE FIRST STEP IS THE ONE DRAWN, because it is the reader's own: what they
   said about @ada, twice, over eight days. A step out of somebody else's hands
   would show the same anatomy and teach less.

   THE FOLD IS THE CONTENT OF THIS SCREEN. `feed-ranking.md` §3.2: what carries a
   step is the folded net of every opinion behind it, not the newest one and not
   their average — the same fold the pad already shows a reader as their Current
   opinion. So the block states the folded value, how many records stand behind
   it, and when the newest of them landed; the note says the rest in the word the
   reader owns.

   THE WAY DOWN IS THE `FactRow`'s OWN ACTION, which is the master's slot for
   exactly this: one line, one word at its end. A separate row would have made
   the records look like a fifth fact about the step rather than what the step is
   made of. */
export function Screen() {
  return (
    <>
      <PageHeader title="One step" backHref="#" backLabel="Back to the path" />
      <ScoreColumn>
        <ScoreOrigin />

        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
          <PathTrace people={[SCORE_VIEWER, ADA_FACED]} size={32} />
        </div>

        <QuietNote>Your opinion of @ada — the first of this path&apos;s two steps.</QuietNote>

        <StepSummary
          pair={{ pDirected: 0.55, pInterest: 0.2 }}
          behind="2 opinions"
          newest="8d"
          onOpenRecords={() => {}}
        />

        <QuietNote>
          You have given @ada two opinions. They add up to one, and that one is what carries — the same adding up the pad
          shows you as your current opinion.
        </QuietNote>
      </ScoreColumn>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
