/* The seal, gated on uploads (media slice): the acts card is the master
   ActsCard, the gate is UploadStatusLine, and the sign button is DISABLED
   while it shows — nothing signs until the content it signs exists. */

/* The chip the acts card shows a topic as. Held out of the conformance round:
   it is a 24px borderless span on `secondary-container`, and `Chip`'s smallest
   rung renders 26px with a hairline and no fill — so adopting it would change
   the drawing, and which of the two is right is jakob's call. */
function ChipMini({ children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", minHeight: 24, padding: "2px 8px", borderRadius: "var(--radius-full)", background: "var(--secondary-container)", color: "var(--on-secondary-container)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "0.5px", flex: "none" }}>
      {children}
    </span>
  );
}

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
                  <ChipMini>#tidemarket</ChipMini>
                  <ChipMini>#coastroad</ChipMini>
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
