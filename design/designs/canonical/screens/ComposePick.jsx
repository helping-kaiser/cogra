/* THE PICK STEP ON THE PHONE (legacy conversion, the conformance round): the
   device gallery, live — two pictures already picked, the rest of the roll
   waiting, and the way out to the photos app itself in the first cell.

   ABOVE THE TRAY'S HAIRLINE IT IS ITS THREE SIBLINGS TO THE PIXEL, which is
   what `PickTray` exists to guarantee: `ComposePickWeb`, `ComposePickVideo`
   and `ComposePickedErrors` draw the same header, the same prompt and the same
   band, and this board now asks for them the same way. "Show all" comes with
   the tray as a REAL BUTTON (jakob, ruling D) — it was the last inert span on
   the canvas, and the band does not move for it.

   THE GRID IS SCREEN-LOCAL, like `ComposePickVideo`'s dead one: a device
   gallery exists on one step of one flow, and the two boards differ in exactly
   the way the states differ — this one takes picks, so its tiles carry
   selection rings and the picked two carry their order. The flat stand-in
   tiles read off the surface-container rungs rather than a local palette, the
   way the dead grid already does. */

/* The picked pair carry their position in the post; the rest wait with an
   empty ring. A ring is drawn white because what it sits on is a photograph. */
function Ring({ index }) {
  const chosen = typeof index === "number";
  return (
    <span
      style={{
        position: "absolute",
        right: 6,
        top: 6,
        width: 20,
        height: 20,
        boxSizing: "border-box",
        borderRadius: "var(--radius-full)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: chosen ? undefined : "1px solid #ffffff",
        background: chosen ? "var(--primary)" : undefined,
        color: chosen ? "var(--on-primary)" : undefined,
        fontSize: "var(--text-label-small)",
        lineHeight: "var(--text-label-small--line-height)",
        fontWeight: "var(--text-label-small--font-weight)",
      }}
    >
      {chosen ? index : null}
    </span>
  );
}

const TILE = { position: "relative", width: 125, height: 125 };
const FILL = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
/* Four rungs of the container ramp, in the roll's own order — a stand-in for
   photographs the board does not have, monotonic so the grid reads as varied
   rather than patterned. */
const SHADES = [
  "var(--surface-container)",
  "var(--surface-container-high)",
  "var(--surface-container-highest)",
  "var(--surface-container)",
  "var(--surface-container-highest)",
  "var(--surface-container-low)",
  "var(--surface-container-high)",
  "var(--surface-container-low)",
];

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <PickPrompt caption="Pick one picture, several, or one video." escapeLabel="Write words instead" />
      <PickTray count={2} onShowAll={() => {}} caption="The first one is the cover.">
        <MediaThumb src="post-photo.jpg" cover />
        <MediaThumb src="inviter.jpg" onRemove={() => {}} />
      </PickTray>

      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 3, padding: "4px 4px 0", overflow: "hidden", alignContent: "flex-start" }}>
        <button
          type="button"
          className="cg-state cg-focus"
          style={{
            width: 125,
            height: 125,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            border: "1px dashed var(--border-field)",
            background: "none",
            boxSizing: "border-box",
            cursor: "pointer",
            padding: 0,
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label-small)",
            lineHeight: "var(--text-label-small--line-height)",
            fontWeight: "var(--text-label-small--font-weight)",
            letterSpacing: "0.5px",
            color: "var(--primary)",
          }}
        >
          <Icon name="image" />
          <span style={{ textAlign: "center" }}>Your photos app</span>
        </button>

        <div style={{ ...TILE, overflow: "hidden" }}>
          <img src="post-photo.jpg" alt="" style={FILL} />
          <Ring index={1} />
        </div>
        <div style={{ ...TILE, overflow: "hidden" }}>
          <img src="inviter.jpg" alt="" style={FILL} />
          <Ring index={2} />
        </div>

        <div style={{ ...TILE, background: "var(--surface-container-low)" }}>
          <Ring />
          <span
            style={{
              position: "absolute",
              left: 6,
              bottom: 6,
              padding: "1px 6px",
              borderRadius: "var(--radius-extra-small)",
              background: "var(--surface-snackbar, rgba(0,0,0,0.55))",
              color: "var(--on-surface-snackbar, #ffffff)",
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              fontWeight: "var(--text-label-small--font-weight)",
              letterSpacing: "0.5px",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Icon name="play_arrow" size={10} />
            0:42
          </span>
        </div>

        {SHADES.map((background, index) => (
          <div key={index} style={{ ...TILE, background }}>
            <Ring />
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 24px 16px" }}>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
