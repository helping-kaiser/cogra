/* THE POST'S CROP (legacy conversion, the conformance round): one shape for
   the whole post, chosen here and applied to every picture in it.

   THE SHAPE CHIPS ARE THE DIFFERENCE FROM THE OTHER TWO CROPS, and the reason
   this board does not take `CropViewport`. A profile picture is shown in a
   circle and a video's cover at the clip's ratio, so both are cut at a LOCKED
   shape and the master draws the cut as a window with everything outside it
   darkened. A post has no such given shape — the author picks it — so this
   surface shows the cut itself, full width, with the rule-of-thirds guides a
   composition decision needs. A window and a mask over a frame the author is
   choosing would darken the part they are choosing between.

   THE STRIP IS `MediaThumb`, dressed the way `CoverRow` dresses its frames:
   the framed picture takes the primary outline offset off the tile, the rest
   sit at 65%. Selection by outline and not by badge, for the same reason —
   at 48px a badge covers the thing being chosen. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Crop" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 16px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip label="Tall 4:5" selected onToggle={() => {}} />
          <Chip label="Square 1:1" onToggle={() => {}} />
          <Chip label="Wide 1.91:1" onToggle={() => {}} />
        </div>

        <div style={{ position: "relative", width: 390, height: 488, margin: "0 -24px", overflow: "hidden", flex: "none" }}>
          <img
            src="post-photo.jpg"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scale(1.15)", transformOrigin: "40% 60%" }}
          />
          {/* The rule of thirds, drawn on the cut rather than around it. */}
          <span aria-hidden="true" style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.55)" }} />
          <span aria-hidden="true" style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.55)" }} />
          <span aria-hidden="true" style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.55)" }} />
          <span aria-hidden="true" style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.55)" }} />
        </div>

        <QuietNote>One shape for the whole post. Drag to move, pinch to zoom.</QuietNote>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ display: "inline-flex", flex: "none", borderRadius: "var(--radius-small)", outline: "2px solid var(--primary)", outlineOffset: 1 }}>
            <MediaThumb src="post-photo.jpg" />
          </span>
          <span style={{ display: "inline-flex", flex: "none", opacity: 0.65 }}>
            <MediaThumb src="inviter.jpg" />
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
