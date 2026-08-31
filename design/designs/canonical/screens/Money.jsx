/* Money — the CGT figure's spec board (item 11). A system board like Theme:
   the mark candidates (the pick), the figure's states, and the balance
   headline — the one surface that spells the word. The B and C marks are
   ideation drawn here only; the system ships exactly one mark (CgtMark). */

function MarkRing({ size = "1em" }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" style={{ verticalAlign: "-0.125em", flex: "none" }}>
      <circle cx="10" cy="10" r="9.25" fill="none" stroke="var(--primary)" strokeWidth="1.5" />
      <path d="M 13.2 5.9 A 5.2 5.2 0 1 0 13.2 14.1" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function MarkGlyph({ size = "1em" }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" style={{ verticalAlign: "-0.125em", flex: "none" }}>
      <path d="M 14.31 4.48 A 7 7 0 1 0 14.31 15.52" fill="none" stroke="var(--primary)" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

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

function Candidate({ tag, name, mark }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", flex: 1 }}>
      <span style={{ fontSize: "var(--text-label-medium)", lineHeight: "var(--text-label-medium--line-height)", fontWeight: "var(--text-label-medium--font-weight)", color: "var(--text-secondary)" }}>
        {tag} · {name}
      </span>
      <span style={{ fontSize: 32, lineHeight: 1 }}>{mark}</span>
      <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        2.00 {mark}
      </span>
    </div>
  );
}

function FigureRow({ words, children }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
      <span style={{ color: "var(--text-secondary)" }}>{words}</span>
      {children}
    </div>
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

      <SpecLabel>The mark — three candidates, one ships</SpecLabel>
      <div style={{ display: "flex", gap: 12 }}>
        <Candidate tag="A" name="the coin" mark={<CgtMark />} />
        <Candidate tag="B" name="the ring" mark={<MarkRing />} />
        <Candidate tag="C" name="the glyph" mark={<MarkGlyph />} />
      </div>

      <SpecLabel>The figure — rest, large, dust, zero</SpecLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FigureRow words="A score-sized amount"><MoneyFigure amount={15.2} /></FigureRow>
        <FigureRow words="A campaign deposit"><MoneyFigure amount={12500} /></FigureRow>
        <FigureRow words="A dust share — never 0.00"><MoneyFigure amount={0.0003} /></FigureRow>
        <FigureRow words="A new member's true state"><MoneyFigure amount={0} /></FigureRow>
      </div>

      <SpecLabel>History lines — the sign and the words carry direction, never a colour</SpecLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FigureRow words="Payout · campaign settled"><MoneyFigure amount={12.4} signed /></FigureRow>
        <FigureRow words="Tip to @ada"><MoneyFigure amount={-2} signed /></FigureRow>
        <FigureRow words="Payout · campaign settled"><MoneyFigure amount={0.0003} signed /></FigureRow>
      </div>

      <SpecLabel>The balance headline — the one surface that spells the word</SpecLabel>
      <Card style={{ flex: "none" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "var(--text-label-medium)", lineHeight: "var(--text-label-medium--line-height)", fontWeight: "var(--text-label-medium--font-weight)", color: "var(--text-secondary)" }}>
              Your balance
            </span>
            <span style={{ fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
              <MoneyFigure amount={128.4} unit />
            </span>
          </div>
          <SystemHelpDot ariaLabel="What is CGT?" />
        </div>
      </Card>
      <p style={{ margin: "8px 0 0", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
        The "?" says it plainly: CGT is CoGra's own money, and the small coin always means CGT. The wallet itself is item 12.
      </p>
    </div>
  );
}
