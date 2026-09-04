/* THE POST'S SEAL (legacy conversion, the conformance round): the last stage,
   where everything the signature commits is read back before it is given.

   IT IS `ComposeSealUploading` WITHOUT THE GATE. That board is this one caught
   mid-upload — the same header slots, the same acts card, the same three facts,
   the same foot — with an upload line above the button and the button disabled
   because nothing signs until the content it signs exists. Here the pictures
   have landed, so the line is gone and the pair is live. Two boards, one
   anatomy, and now one source for it.

   THE STANCE IS THE `StanceReadout`, PAIR AND ALL. The row used to print a
   single number while the reference row two lines above printed the pair — one
   quantity, two spellings, on one board. The readout is the system's spelling
   and it is what the uploading twin already shows. */
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
              /* The staged citation carries the stance that rides with it, so
                 the row is two lines: what is cited, and what signing it says
                 about the citer. */
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

        <SealFooter signLabel="Sign and publish" />
      </div>
    </>
  );
}
