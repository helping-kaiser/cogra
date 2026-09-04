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
   cover it, the note, and Cancel · Set — release never commits, Set does. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Salt maps of the coast road — 2 pictures.</QuietNote>
        <ActsCard total="4 signed actions" note="they land together, or none does" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value="Public domain — your default" />
          <FactRow
            label="Where you stand on it"
            value={<StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />}
            action="Adjust"
            last
          />
        </div>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Sign and publish</Button>
      </div>

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
          <HelpDot ariaLabel="How stances work" />
        </span>

        {/* The pick's readout, in the pad's own block shape: the name of the
            quantity, then the face and the number under it. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span aria-hidden="true" style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            Your pick
          </span>
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>😄</span>
            <span style={{ fontSize: "var(--text-body-small)", whiteSpace: "nowrap" }}>+0.30</span>
          </span>
          <span style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
            Glad, For or against +0.30
          </span>
        </div>

        <div
          role="group"
          aria-label="Stance pad for your own post"
          style={{ alignSelf: "center", position: "relative", width: 260, height: 72, borderRadius: "var(--radius-large)", background: "var(--surface-field)", touchAction: "none" }}
        >
          <span aria-hidden="true" style={{ position: "absolute", left: 8, right: 8, top: "50%", height: 1, background: "var(--border-hairline)" }} />
          <span aria-hidden="true" style={{ position: "absolute", left: "50%", top: 8, bottom: 8, width: 1, background: "var(--border-hairline)" }} />
          <span aria-hidden="true" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", padding: "0 2px", background: "var(--surface-field)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            Against
          </span>
          <span aria-hidden="true" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", padding: "0 2px", background: "var(--surface-field)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
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
