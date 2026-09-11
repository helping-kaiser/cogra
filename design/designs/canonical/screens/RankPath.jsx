/* ONE PATH — level two of the Post score's drill-down (backlog item 13). A path
   row on `FeedEntry` opens it, and it says what that one route does and what it
   is made of.

   THE STRONGEST PATH IS THE ONE DRAWN, and it is the instructive one: it runs
   through the author herself, so its two steps are of two different kinds — an
   opinion the reader gave, and the author's own publishing of the post. A board
   drawing two opinion steps would have hidden that a publish is a step at all.

   WHY A PUBLISH CARRIES. `feed-ranking.md` §4's traversal table puts Publish
   among the families traversable at the folded weight, and the composer's seal
   already tells the author that signing publishes their own opinion with it
   (`ComposeSealBody`'s "Your opinion" row). So the last step into the post is
   @ada's own — which is also why its age is the post's age.

   THE FACTS COME BEFORE THE STEPS. What the path does is what the reader came
   for; how it is built is the answer underneath. The ages are on the ladder like
   every other timestamp, and the newest one is the path's own last step, because
   only the last step decays (§5.3) — an old friendship with a fresh opinion at
   its end competes at full weight, and that is the fact this block makes
   checkable.

   NO STEP CARRIES A NUMBER OF ITS OWN. A path's contribution is not the product
   of the opinions drawn along it — the per-step weight is damped and tier-bound
   (§3.1) and only the terminal step decays — so a figure on every row would
   invite an arithmetic that does not hold. Each step states what carries it and
   when; the path states what it adds. */
export function Screen() {
  return (
    <>
      <PageHeader title="One path" backHref="#" backLabel="Back to the paths" />
      <ScoreColumn>
        <ScoreOrigin />

        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
          <PathTrace people={SCORE_PATHS[0].people} size={32} />
        </div>

        <PathSummary adds="+6.80" newest="2h" />

        <SectionLabel>The steps</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ContentRow
            variant="chronicle"
            face={{ pDirected: 0.55, pInterest: 0.2 }}
            title="Your opinion of @ada"
            second="2 opinions behind it"
            trailing="8d"
            onOpen={() => {}}
          />
          <ContentRow
            variant="chronicle"
            face={{ pDirected: 0.1, pInterest: 0.1 }}
            title="@ada published it"
            second="Her own opinion rides the post"
            trailing="2h"
            onOpen={() => {}}
          />
        </div>
      </ScoreColumn>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
