/* Show all over the pick step (media slice): the per-picture manager —
   reorder (first = cover), remove, describe. The tray behind stays the pick
   step's own; the sheet is the master PickedSheet. */
const PICKED = [
  { src: "post-photo.jpg", alt: "The coast road", described: true },
  { src: "gallery-market.jpg", alt: "", onDescribe: () => {}, onRemove: () => {} },
  { src: "gallery-honey.jpg", alt: "", onDescribe: () => {}, onRemove: () => {} },
];

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" action={<Button size="sm">Next</Button>} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 24px" }}>
        <p style={{ margin: 0, flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
          Pick one picture, several, or one video.
        </p>
        <Button variant="text" size="sm">Write words instead</Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 24px 12px", borderBottom: "1px solid var(--border-hairline)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ flex: 1, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "0.5px", color: "var(--text-secondary)" }}>
            Picked · 3
          </span>
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "0.5px", color: "var(--primary)" }}>
            Show all
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {PICKED.map((item) => (
            <MediaThumb key={item.src} src={item.src} alt={item.alt} />
          ))}
        </div>
      </div>
      <div style={{ flex: 1 }} />

      <PickedSheet open items={PICKED} onClose={() => {}} />
    </>
  );
}
