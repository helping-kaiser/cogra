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
      <PickPrompt caption="Pick one picture, several, or one video." escapeLabel="Write words instead" />
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
