/* Show all over the pick step (media slice): the per-picture manager —
   reorder (first = cover), remove, describe. The tray behind is `PickTray`,
   the sheet over it `PickedSheet`. */
const PICKED = [
  { src: "post-photo.jpg", alt: "The coast road", described: true },
  { src: "gallery-market.jpg", alt: "", onDescribe: () => {}, onRemove: () => {} },
  { src: "gallery-honey.jpg", alt: "", onDescribe: () => {}, onRemove: () => {} },
];

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 24px" }}>
        <p style={{ margin: 0, flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
          Pick one picture, several, or one video.
        </p>
        <Button variant="text" size="sm">Write words instead</Button>
      </div>
      <PickTray count={3} onShowAll={() => {}}>
        {PICKED.map((item) => (
          <MediaThumb key={item.src} src={item.src} alt={item.alt} />
        ))}
      </PickTray>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "12px 24px 16px" }}>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>

      <PickedSheet open items={PICKED} onClose={() => {}} />
    </>
  );
}
