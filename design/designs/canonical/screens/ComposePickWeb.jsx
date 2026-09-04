/* The pick step on the WEB (media slice, round 3): browsers have no
   device-gallery API, so the newest-images grid cannot exist there. Web's
   equivalent is the file picker and a drop target — one calm region instead
   of the grid, the rest of the step identical (caption, the picked tray, the
   text path). The button opens the browser's own picker; dropping works where
   a desktop exists and costs nothing on a phone. */
export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <PickPrompt caption="Pick one picture, several, or one video." escapeLabel="Write words instead" />
      <PickTray count={2} onShowAll={() => {}} caption="The first one is the cover.">
        <MediaThumb src="post-photo.jpg" cover />
        <MediaThumb src="gallery-market.jpg" onRemove={() => {}} />
      </PickTray>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 24px 24px" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            border: "1px dashed var(--border-field)",
            borderRadius: "var(--radius-medium)",
            padding: 24,
          }}
        >
          <span style={{ display: "inline-flex", width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", background: "var(--surface-container-high)", color: "var(--text-secondary)" }}>
            <Icon name="add" />
          </span>
          <Button variant="outline">Choose from your files</Button>
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
            …or drop them here.
          </span>
        </div>
        <Button style={{ width: "100%", marginTop: 16 }}>Next</Button>
      </div>
    </>
  );
}
