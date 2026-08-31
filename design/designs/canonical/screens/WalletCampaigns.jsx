/* The campaigns page (item 12 round 3, jakob): its own full page off the
   wallet's door — create campaigns, see the open ones, the history of past
   ones, and (the second segment) the campaigns you took part in but weren't
   yours. Money view throughout; a campaign's full page (anchors, reach) is a
   future item. */

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
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, padding: "8px 16px 16px" }}>
        <Button style={{ width: "100%" }}>Start a campaign</Button>

        <SegmentedFilter
          ariaLabel="Whose campaigns"
          options={[
            { value: "yours", label: "Yours" },
            { value: "part", label: "You took part" },
          ]}
          value="yours"
          onChange={() => {}}
        />

        <SectionLabel>Open</SectionLabel>
        <CampaignRow
          image="gallery-market.jpg"
          title="Sunday at the tide market"
          context="In escrow · runs 6 more days"
          trailing={<MoneyFigure amount={12500} />}
          onOpen={() => {}}
        />

        <SectionLabel>Past</SectionLabel>
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

        <div style={{ flex: 1 }} />
        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)", textAlign: "center" }}>
          "You took part" lists the campaigns that paid you, with what each one paid.
        </p>
      </div>
    </>
  );
}
