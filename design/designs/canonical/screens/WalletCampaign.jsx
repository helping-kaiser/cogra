/* The campaign's own subpage (item 12 round 2, jakob: committing 12,500 is a
   big deal and deserves its own page): still a MONEY view — deposit, escrow,
   window, what settlement means — with the campaign's rail history beneath.
   The campaign's full page (anchors, reach, settlement detail) is a future
   item; this is the wallet's window into it. */

function FactRow({ label, value, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, borderBottom: last ? undefined : "1px solid var(--border-hairline)" }}>
      <span style={{ flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function Screen() {
  return (
    <>
      <PageHeader title="Your campaign" backHref="#" backLabel="Back to the wallet" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, padding: "8px 16px 16px" }}>
        <Card style={{ flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="gallery-market.jpg" alt="" style={{ width: 48, height: 48, borderRadius: "var(--radius-small)", objectFit: "cover", flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Sunday at the tide market
              </span>
              <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
                Raising reach toward your post
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <FactRow label="Deposit" value={<MoneyFigure amount={12500} />} />
            <FactRow label="Where it sits" value="In escrow, on the rail" />
            <FactRow label="Window" value="Runs 6 more days · ends 8 Sep" />
            <FactRow label="At settlement" value="One public record" last />
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
            Every payout will be traceable to the paths that carried the reach. What the window doesn't spend returns when it settles.
          </p>
        </Card>

        <SectionLabel>On the rail</SectionLabel>
        <LedgerRow words="Campaign deposit" context="In escrow · funded from this wallet" when="12d" amount={-12500} glyph="campaign" onOpen={() => {}} />

        <div style={{ flex: 1 }} />
      </div>
    </>
  );
}
