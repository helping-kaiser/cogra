/* THE FAULT IN PLACE (legacy conversion, lane C) — the pattern board for a
   transport failure, drawn where one actually happens: the post's seal, after
   Sign and publish didn't reach anything.

   IT IS `ComposeSeal`, UNSENT. Same header slots, same acts card, same three
   facts — because the whole point of the pattern is that nothing is taken away
   when a send fails. What the author signed is still exactly what they read a
   moment ago, still there to check, and the fault is added at the foot rather
   than replacing the surface with an error screen.

   THE ALERT IS `TransportError`, which is where the system keeps its failure
   voice — the one place `--error` is spent on a line of prose, and the reason
   a fault reads as a fault rather than as a warning-coloured note.

   THE FOOT IS NOT `SealFooter`. That footer's pair is commit-and-go-back, and
   there is nothing to commit until the send works: what stands here instead is
   the retry, outlined because it is not a new commitment, over the same way
   back the seal has. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" help="Signed actions" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Salt maps of the coast road — 2 pictures.</QuietNote>

        <ActsCard
          rows={[
            { label: "Post", value: "Salt maps of the coast road", count: "1 action" },
            {
              label: "Topics",
              value: (
                <span style={{ display: "flex", gap: 6, overflow: "hidden", alignItems: "center" }}>
                  <Chip label="#fieldnotes" tone="readout" />
                  <Chip label="#coastroad" tone="readout" />
                </span>
              ),
              count: "2 actions",
            },
            {
              label: "References",
              value: (
                <span style={{ display: "flex", flexDirection: "column", padding: "6px 0", minWidth: 0 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>The long way home — @ada</span>
                  <StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />
                </span>
              ),
              count: "1 action",
            },
          ]}
          total="4 signed actions"
          note="they land together, or none does"
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value="Public domain — your default" action="Change" />
          <FactRow
            label="Where you stand on it"
            value={<StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />}
            action="Adjust"
          />
          <FactRow label="Sensitive" value="Not marked" action="Mark" last />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TransportError message="That didn't send. Try again." />
          <Button variant="outline" style={{ width: "100%" }}>Retry</Button>
          <Button variant="text" style={{ width: "100%" }}>Back</Button>
        </div>
      </div>
    </>
  );
}
