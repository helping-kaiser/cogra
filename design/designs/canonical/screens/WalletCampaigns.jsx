/* The campaigns page (item 12 rounds 3–4): the wallet's second full page —
   create campaigns, the open ones, the past ones, and the campaigns you took
   part in. Round 4: it speaks the wallet's own language — the wash moment
   card carries the escrow summary and the Start action (no bare CTA slapped
   on top), the segments sit centered at their true size, and the took-part
   explainer rides quietly under them instead of floating in dead space. */

function CampaignRow({ image, title, context, trailing, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        border: 0,
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-card)",
        padding: 12,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        color: "var(--on-surface)",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    >
      {image ? (
        <img src={image} alt="" style={{ width: 40, height: 40, borderRadius: "var(--radius-small)", objectFit: "cover", flex: "none" }} />
      ) : (
        <span style={{ width: 40, height: 40, borderRadius: "var(--radius-full)", background: "var(--surface-container-high)", color: "var(--text-secondary)", display: "grid", placeItems: "center", flex: "none" }}>
          <Icon name="campaign" size={20} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {context}
        </span>
      </span>
      {trailing && (
        <span style={{ flex: "none", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{trailing}</span>
      )}
      <span style={{ flex: "none", display: "inline-flex", color: "var(--text-secondary)" }} aria-hidden="true">
        <Icon name="chevron_right" size={18} />
      </span>
    </button>
  );
}

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
          <CampaignRow
            image="gallery-market.jpg"
            title="Sunday at the tide market"
            context="In escrow · runs 6 more days"
            trailing={<MoneyFigure amount={12500} />}
            onOpen={() => {}}
          />
        </div>

        <SectionLabel>Past</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          <CampaignRow
            image="post-photo.jpg"
            title="Postcard run"
            context="Settled 28 Aug · 1,730.00 returned"
            onOpen={() => {}}
          />
          <CampaignRow
            title="Salt maps launch"
            context="Settled 12 Jul · fully paid out"
            onOpen={() => {}}
          />
        </div>

        <div style={{ flex: 1 }} />
      </div>
    </>
  );
}
