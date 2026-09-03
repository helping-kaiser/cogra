/* The pick step with a clip staged (video conform round, 2026-09-03) — the
   post scale of "a video is the whole body". A post carries pictures OR one
   video, so the moment a clip is in, the step has nothing left to offer: the
   grid stops taking picks and the escape to the photos app goes with it.

   AN ABSENT CONTROL EXPLAINS NOTHING ON ITS OWN (jakob 2026-09-03), so the
   line the tray carries for pictures — "The first one is the cover." — is
   replaced by the one this state needs: "A video is the whole post. Its cover
   comes next." It says why nothing else can join AND what happens next, in
   the space the controls left. Removing the clip (the tile's ×) gives the
   step back.

   NO "Show all": that sheet reorders a set and names its cover. One clip is
   not a set, and its cover is the next step's whole subject.

   WEB TAKES THIS STATE 1:1 — the drop region and the file dialog play the
   grid's part and the staged state is identical, so no web board is drawn
   (the same blessing ComposePickWeb's refusals ride on). */

/* The device-gallery grid, inert: no selection rings, nothing to tap. Its
   markup is screen-local — the pick grid exists on one step of one flow. */
function DeadGrid() {
  const tiles = ["var(--surface-container)", "var(--surface-container-high)", "var(--surface-container-highest)", "var(--surface-container-high)", "var(--surface-container)", "var(--surface-container-highest)", "var(--surface-container-high)", "var(--surface-container)", "var(--surface-container-highest)"];
  return (
    <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 3, padding: "4px 4px 0", overflow: "hidden", alignContent: "flex-start", opacity: 0.4 }}>
      <div style={{ position: "relative", width: 125, height: 125, overflow: "hidden" }}>
        <img src="post-photo.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      {tiles.map((bg, index) => (
        <div key={index} style={{ width: 125, height: 125, background: bg }} />
      ))}
    </div>
  );
}

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
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 24px 12px", borderBottom: "1px solid var(--border-hairline)" }}>
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "0.5px", color: "var(--text-secondary)" }}>
          Picked · 1
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MediaThumb src="post-photo.jpg" alt="" size={48} video onRemove={() => {}} removeLabel="Remove this video" />
          <span style={{ flex: 1, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
            A video is the whole post. Its cover comes next.
          </span>
        </div>
      </div>
      <DeadGrid />
      <div style={{ padding: "12px 24px 16px" }}>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
