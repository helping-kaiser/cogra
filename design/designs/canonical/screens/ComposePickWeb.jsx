/* The pick step on the WEB (media slice, round 3): browsers have no
   device-gallery API, so the newest-images grid cannot exist there. Web's
   equivalent is the file picker and a drop target — one calm region instead
   of the grid, the rest of the step identical (caption, the picked tray, the
   text path). The button opens the browser's own picker; dropping works where
   a desktop exists and costs nothing on a phone.

   A CLIP STAGED DIMS THE REGION (seam 245, ask 13 A; the `body` chip at
   `video`, under the autonomy order of 2026-10-28). The phone's dead grid has
   a web analogue: the region stays where it was, inert and dimmed at the dead
   grid's opacity, with nothing left to press — `Choose from your files` and
   the drop line go, as the photos-app door goes on the phone. The tray takes
   `ComposePickVideo`'s clip tile and line. A file dropped on the dimmed region
   anyway is refused in words like any other pick, never opened by the
   browser and never dropped in silence. */
export const PROPS = { body: { editor: "enum", options: ["pictures", "video"], default: "pictures" } };
export const VALS = `picturesShown: this.props.body === "video" ? "none" : "flex", videoShown: this.props.body === "video" ? "flex" : "none"`;

const REGION = {
  flex: 1,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  border: "1px dashed var(--border-field)",
  borderRadius: "var(--radius-medium)",
  padding: 24,
};

function AddDisc() {
  return (
    <span style={{ display: "inline-flex", width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", background: "var(--surface-container-high)", color: "var(--text-secondary)" }}>
      <Icon name="add" />
    </span>
  );
}

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" backLabel="Back" />
      <PickPrompt caption="Pick one picture, several, or one video." escapeLabel="Write words instead" />
      <div style={{ display: "{{picturesShown}}", flexDirection: "column" }}>
        <PickTray count={2} onShowAll={() => {}} caption="The first one is the cover.">
          <MediaThumb src="post-photo.jpg" cover onRemove={() => {}} />
          <MediaThumb src="gallery-market.jpg" onRemove={() => {}} />
        </PickTray>
      </div>
      <div style={{ display: "{{videoShown}}", flexDirection: "column" }}>
        <PickTray count={1} caption="A video is the whole post. Its cover comes next.">
          <MediaThumb src="post-photo.jpg" alt="" width={114} height={64} video onRemove={() => {}} removeLabel="Remove this video" />
        </PickTray>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 24px 24px" }}>
        <div style={{ ...REGION, display: "{{picturesShown}}" }}>
          <AddDisc />
          <Button variant="outline">Choose from your files</Button>
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            …or drop them here.
          </span>
        </div>
        <div style={{ ...REGION, display: "{{videoShown}}", opacity: 0.45 }}>
          <AddDisc />
        </div>
        <Button style={{ width: "100%", marginTop: 16 }}>Next</Button>
      </div>
    </>
  );
}