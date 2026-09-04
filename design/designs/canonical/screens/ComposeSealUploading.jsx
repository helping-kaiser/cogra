/* The seal, gated on uploads (media slice): the acts card is the master
   ActsCard, the gate is UploadStatusLine, and the sign button is DISABLED
   while it shows — nothing signs until the content it signs exists. */

export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" help="Signed actions" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Sunday at the tide market — 4 pictures.</QuietNote>

        <ActsCard
          rows={[
            { label: "Post", value: "Sunday at the tide market", count: "1 action" },
            {
              label: "Topics",
              value: (
                <span style={{ display: "flex", gap: 6, overflow: "hidden", alignItems: "center" }}>
                  <Chip label="#tidemarket" tone="readout" />
                  <Chip label="#coastroad" tone="readout" />
                </span>
              ),
              count: "2 actions",
            },
          ]}
          total="3 signed actions"
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

        <UploadStatusLine done={2} total={4} />

        <SealFooter signLabel="Sign and publish" disabled />
      </div>
    </>
  );
}
