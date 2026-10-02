/* The seal, gated on uploads (media slice): the acts card is the master
   ActsCard, the gate is UploadStatusLine, and the sign button is DISABLED
   while it shows — nothing signs until the content it signs exists.

   THE GATE NAMES ITS CONTENT (jakob 2026-10-02, pads 3): pictures read
   `…signing waits for the pictures.`, a clip from `ComposeDetailsVideo`
   `…signing waits for the video.` (`UploadStatusLine`'s `media`).

   SIGNING PROCEEDS WHEN THE UPLOADS LAND (jakob 2026-10-02, pads 5): the
   reader already pressed Sign; the gate waits only for bytes, so no second
   press is asked. */

export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" help="How signing works" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Sunday at the tide market — 4 pictures.</QuietNote>

        <ActsCard
          rows={[
            { label: "Post", value: "Sunday at the tide market", count: "1", countNoun: "post" },
            {
              label: "Tags",
              value: (
                <span style={{ display: "flex", gap: 6, overflow: "hidden", alignItems: "center" }}>
                  <Chip label="#tidemarket" tone="readout" />
                  <Chip label="#coastroad" tone="readout" />
                </span>
              ),
              count: "2",
              countNoun: "tag",
            },
          ]}
          total="3 things, signed together"
          note="They land together, or none does."
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value={<LicenseSummary />} action="Change" />
          <FactRow
            label="Your opinion"
            value={<OwnStanceReadout pDirected={0.1} />}
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
