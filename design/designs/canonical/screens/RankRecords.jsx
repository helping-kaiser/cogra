/* WHAT LANDED — level four, the floor of the Post score's drill-down (backlog
   item 13). The two signed records behind one step, and below them there is
   nothing but the network's own published sequence.

   THIS IS THE HONESTY CASE'S LAST SCREEN. `architecture.md`'s feed query hands
   the client raw records and lets it rank them; `feed-ranking.md` §6.1 binds
   every implementation to compute the sum exactly rather than sample it, and §11
   says why: so any consumer can spot-check any ranking claim from public records
   alone. A drill-down that stopped at a summary would have asked to be believed.
   This one stops at the evidence.

   THE ARITHMETIC CLOSES HERE TOO. +0.45 / +0.10 and +0.10 / +0.10 add to the
   +0.55 / +0.20 the step carries — the fold a reader already meets as their
   current opinion, spelled out in the two records that make it.

   THE ROWS ARE INERT. A record is a fact with no destination of its own
   (`ContentRow`'s rule), and what a reader would chase is its identity, which
   the row states rather than hiding behind a tap.

   THE OLDER RECORD WEARS A DATE, not a rung of the ladder: past thirty days
   recency stops being a feeling and history takes over (copy-voice, *Ages*).

   THE KEY IS DISPLAY-ONLY (jakob 2026-09-12). It is drawn in mono because a
   reader checking a claim has to be able to see it, and the control that copies
   it arrives with the spot-check tooling that would give a copied key somewhere
   to go — a control that fills a clipboard nothing can yet read promises a
   workflow the product does not have. */
const STEP_RECORDS = [
  {
    what: "Your opinion of @ada",
    pair: { pDirected: 0.45, pInterest: 0.1 },
    when: "8d",
    key: "3f9c2a41b77e0d58",
  },
  {
    what: "Your opinion of @ada",
    pair: { pDirected: 0.1, pInterest: 0.1 },
    when: "14.02.2026",
    key: "a0417be2c9d3f16b",
  },
];

export function Screen() {
  return (
    <>
      <PageHeader title="What landed" backHref="#" backLabel="Back to the step" />
      <ScoreColumn>
        <ScoreOrigin />
        <QuietNote>The two records behind your opinion of @ada.</QuietNote>

        <ActionLog records={STEP_RECORDS} />

        <QuietNote>
          These records are public. Anyone can run the same sum and land on the same number.
        </QuietNote>
      </ScoreColumn>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
