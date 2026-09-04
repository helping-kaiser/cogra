/* The campaigns page (item 12 rounds 3–4): the wallet's second full page —
   create campaigns, the open ones, the past ones, and the campaigns you took
   part in. Round 4: it speaks the wallet's own language — the wash moment
   card carries the escrow summary and the Start action (no bare CTA slapped
   on top), the segments sit centered at their true size, and the took-part
   explainer rides quietly under them instead of floating in dead space.

   EVERY CAMPAIGN IS `ContentRow`'s `campaign` variant — the wallet history's
   own row, with the cover as a tile because a campaign is a thing with a
   face rather than somebody with one. */

export function Screen() {
  return (
    <>
      <PageHeader title="Campaigns" backHref="#" backLabel="Back to the wallet" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 0 0" }}>
        <WashCard>
          <span
            style={{
              fontSize: "var(--text-label-medium)",
              lineHeight: "var(--text-label-medium--line-height)",
              fontWeight: "var(--text-label-medium--font-weight)",
              letterSpacing: "var(--text-label-medium--letter-spacing)",
              color: "var(--text-secondary)",
            }}
          >
            In escrow right now
          </span>
          <span
            style={{
              position: "relative",
              fontSize: "var(--text-display-small)",
              lineHeight: "var(--text-display-small--line-height)",
              fontWeight: "var(--text-title-large--font-weight)",
            }}
          >
            <MoneyFigure amount={12500} />
          </span>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
              1 open campaign
            </span>
            <Button size="sm">Start a campaign</Button>
          </div>
        </WashCard>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 16px 0" }}>
          <SegmentedFilter
            ariaLabel="Whose campaigns"
            options={[
              { value: "yours", label: "Yours" },
              { value: "part", label: "You took part" },
            ]}
            value="yours"
            onChange={() => {}}
          />
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)", textAlign: "center" }}>
            "You took part" lists the campaigns that paid you.
          </span>
        </div>

        <SectionLabel>Open</SectionLabel>
        <div style={{ padding: "0 16px" }}>
          <ContentRow
            variant="campaign"
            image="gallery-market.jpg"
            title="Sunday at the tide market"
            second="In escrow · runs 6 more days"
            trailing={<MoneyFigure amount={12500} />}
            onOpen={() => {}}
          />
        </div>

        <SectionLabel>Past</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          <ContentRow
            variant="campaign"
            image="post-photo.jpg"
            title="Postcard run"
            second="Settled 28 Aug · 1,730.00 returned"
            onOpen={() => {}}
          />
          <ContentRow
            variant="campaign"
            title="Salt maps launch"
            second="Settled 12 Jul · fully paid out"
            glyph="campaign"
            onOpen={() => {}}
          />
        </div>

        <div style={{ flex: 1 }} />
      </div>
    </>
  );
}
