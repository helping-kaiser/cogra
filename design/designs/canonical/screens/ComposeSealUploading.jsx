/* The seal, gated on uploads (media slice): the acts card is the master
   ActsCard, the gate is UploadStatusLine, and the sign button is DISABLED
   while it shows — nothing signs until the content it signs exists. */

function SealRow({ label, value, action, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, borderTop: "1px solid var(--border-hairline)", borderBottom: last ? "1px solid var(--border-hairline)" : undefined }}>
      <span style={{ flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", whiteSpace: "nowrap" }}>{label}</span>
      {value}
      {/* A plain primary word, as the decided seal draws it — a 64px-min
          Button here wraps the row that the ruling keeps to one line. */}
      <button
        type="button"
        className="cg-state cg-focus cg-hit"
        style={{ border: 0, background: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", letterSpacing: "var(--text-label-large--letter-spacing)", color: "var(--primary)", flex: "none" }}
      >
        {action}
      </button>
    </div>
  );
}

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
      <WizardHeader
        title="What you sign"
        action={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Last step</span>
            <SystemHelpDot ariaLabel="Signed actions" />
          </span>
        }
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Sunday at the tide market — 4 pictures.
        </p>

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
          <SealRow label="License" value={<span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>Public domain — your default</span>} action="Change" />
          <SealRow
            label="Where you stand on it"
            value={<StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />}
            action="Adjust"
          />
          <SealRow label="Sensitive" value={<span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>Not marked</span>} action="Mark" last />
        </div>

        <div style={{ flex: 1 }} />

        <UploadStatusLine done={2} total={4} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button disabled style={{ width: "100%" }}>Sign and publish</Button>
          <Button variant="text" style={{ width: "100%" }}>Back</Button>
        </div>
      </div>
    </>
  );
}
