/* THE STANCE PAD ON YOUR OWN POST (legacy conversion, the conformance round):
   what the seal's "Adjust" opens. The wash covers the seal; only the parked
   pad is live, which is what the board's `scanExempt` line says.

   THE FIELD IS ONE AXIS, and that is why `StancePad` is not here. The master
   is the square where the drawn field IS the value space — Against/For across,
   Less/More up — because both parameters are the author's to choose. On one's
   OWN post the second is not: your own post always reaches you in full, so
   `pInterest` is not a thing to pick and a square offering it would offer a
   choice that is not one. What is left is a line, and a line is drawn as one.
   The system has no one-axis pad; this board is the only surface that wants
   one, so it draws its own and the gap is reported rather than filled in
   passing.

   EVERYTHING AROUND THE FIELD IS THE PAD'S OWN GRAMMAR, kept: the "?" in the
   top-right corner out of the readouts' reading order (`HelpDot`, at the
   master's geometry), the pick's readout ABOVE the field where a thumb cannot
   cover it, the note, and Cancel · Set — release never commits, Set does. The
   readout's number carries `cg-exact` exactly as the master's does, so a
   hand-drawn readout follows the reading mode instead of diverging from it
   (readme §13).

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody`, the same body
   `ComposeSeal` draws. What a wash covers is inert, not shortened. */
export function Screen() {
  return (
    <>
      <ComposeSealBody />

      {/* The wash over the shell; the parked pad above it stays sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-wash, rgba(0, 0, 0, 0.5))" }} />

      <div
        style={{
          position: "absolute",
          left: 30,
          right: 30,
          bottom: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          borderRadius: "var(--radius-extra-large)",
          background: "var(--surface-dialog)",
          color: "var(--on-surface)",
          padding: "var(--card-padding)",
          boxSizing: "border-box",
        }}
      >
        <span style={{ position: "absolute", top: 4, right: 4 }}>
          <HelpDot ariaLabel="Your opinion on your post" />
        </span>

        {/* The pick's readout, in the pad's own block shape: the name of the
            quantity, then the face and the number under it. */}
        {/* The readout clears the corner the "?" sits in, the way the master's
            own standing block does. */}
        <div style={{ display: "flex", flexDirection: "column", paddingRight: 40 }}>
          <span aria-hidden="true" style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            Your pick
          </span>
          {/* THE FACE AND THE WORD COME FROM `STANCE_ANCHORS`: at +0.30 the
              nearest anchor is the table's first row, 🙂 "Nice" (0.15 / 0.15).
              They are spelled here because `nearestAnchor` is not among the
              names the bundle exposes to screens — the value is the table's,
              not this board's, and the pad must never name a face the system
              has no row for. */}
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🙂</span>
            <span className="cg-exact" style={{ fontSize: "var(--text-body-small)", whiteSpace: "nowrap" }}>+0.30</span>
          </span>
          <span style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
            Nice, For or against +0.30
          </span>
        </div>

        <div
          role="group"
          aria-label="Opinion pad for your own post"
          style={{ alignSelf: "center", position: "relative", width: 260, height: 72, borderRadius: "var(--radius-large)", background: "var(--surface-container-highest)", touchAction: "none" }}
        >
          <span aria-hidden="true" style={{ position: "absolute", left: 8, right: 8, top: "50%", height: 1, background: "var(--border-hairline)" }} />
          <span aria-hidden="true" style={{ position: "absolute", left: "50%", top: 8, bottom: 8, width: 1, background: "var(--border-hairline)" }} />
          <span aria-hidden="true" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", padding: "0 2px", background: "var(--surface-container-highest)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            Against
          </span>
          <span aria-hidden="true" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", padding: "0 2px", background: "var(--surface-container-highest)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            For
          </span>
          <span aria-hidden="true" style={{ position: "absolute", left: "65%", top: "50%", width: 24, height: 24, margin: "-12px 0 0 -12px", borderRadius: "var(--radius-full)", background: "var(--surface-loud)", border: "1px solid var(--on-surface-loud)" }} />
        </div>

        <QuietNote>Your own post always reaches you in full.</QuietNote>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text" size="sm">Cancel</Button>
          <Button size="sm">Set</Button>
        </div>
      </div>
    </>
  );
}
