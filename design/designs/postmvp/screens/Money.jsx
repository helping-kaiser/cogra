/* Money — the CGT figure's spec board (item 11). A system board like Theme:
   the mark (the brand mark on the coin — decided 2026-08-31, after a lone C
   read as any game's coin), the figure's states, and the balance headline —
   the one surface that spells the word.

   `SpecLabel` IS NOT `SectionLabel`, deliberately: the system's caption carries
   the screen gutter itself, for a scroll column of full-bleed rows, and this
   board already pads its own. The ruling is recorded in `SectionLabel.jsx`. */

function SpecLabel({ children }) {
  return (
    <span
      style={{
        display: "block",
        padding: "16px 0 6px",
        fontSize: "var(--text-label-small)",
        lineHeight: "var(--text-label-small--line-height)",
        fontWeight: "var(--text-label-small--font-weight)",
        letterSpacing: "var(--text-label-small--letter-spacing, 0.5px)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}

export function Screen() {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "20px 24px 0" }}>
      <h1 style={{ margin: 0, fontSize: "var(--text-title-large)", lineHeight: "var(--text-title-large--line-height)", fontWeight: "var(--text-title-large--font-weight)" }}>
        Money — the CGT figure
      </h1>
      <p style={{ margin: "6px 0 0", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
        One shape for every amount. The unit is the mark, never the word — the word appears once, on the balance headline, beside its "?".
      </p>

      <SpecLabel>The mark — the brand mark on the coin, 1em, scales with its text</SpecLabel>
      <div style={{ display: "flex", gap: 20, alignItems: "baseline" }}>
        <span style={{ fontSize: 14 }}><CgtMark /></span>
        <span style={{ fontSize: 20 }}><CgtMark /></span>
        <span style={{ fontSize: 32 }}><CgtMark /></span>
        <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          2.00 <CgtMark />
        </span>
      </div>

      <SpecLabel>The figure — rest, large, dust, zero</SpecLabel>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <FactRow emphasis="ledger" label="A score-sized amount" value={<MoneyFigure amount={15.2} />} />
        <FactRow emphasis="ledger" label="A campaign deposit" value={<MoneyFigure amount={12500} />} />
        <FactRow emphasis="ledger" label="A dust share — never 0.00" value={<MoneyFigure amount={0.0003} />} />
        <FactRow emphasis="ledger" label="A new member's true state" value={<MoneyFigure amount={0} />} last />
      </div>

      <SpecLabel>History lines — the sign and the words carry direction, never a colour</SpecLabel>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <FactRow emphasis="ledger" label="Payout · campaign settled" value={<MoneyFigure amount={12.4} signed />} />
        <FactRow emphasis="ledger" label="Tip to @ada" value={<MoneyFigure amount={-2} signed />} />
        <FactRow emphasis="ledger" label="Payout · campaign settled" value={<MoneyFigure amount={0.0003} signed />} last />
      </div>

      <SpecLabel>The balance headline — the one surface that spells the word</SpecLabel>
      <WalletBalance amount={128.4} approx="0.00087" onHelp={() => {}} />
      <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
        The "?" says it plainly: CGT is CoGra's own money, and the small coin always means CGT.
      </p>
    </div>
  );
}
