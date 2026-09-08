/* THE STANCE PAD ON THE POST YOU ANSWER (legacy conversion, lane C): what the
   reply seal's "Adjust" opens. The wash covers the seal; only the parked pad is
   live, which is what the board's `scanExempt` line says.

   THE FIELD IS THE MASTER, both axes. Unlike `ComposePad` — where the author's
   own post always reaches them in full, so only one parameter is theirs to pick
   — a reply's stance is toward somebody else's post: for or against it, and how
   much of them reaches you. Both are choices, so the value space is the square
   `StancePad` draws, and the pad reads from it rather than drawing its own.

   IT KEEPS THE HAND BOARD'S 240px FIELD, centred, rather than letting the
   square fill the panel: the pad is a thumb-sized instrument and the drawing is
   the one the round inherited. Everything inside it — the dead centre-lines,
   the four named directions, the knob and where it sits for +0.10 / +0.10 — is
   now the master's.

   THE READOUT NAMES ITS TARGET where `ComposePad`'s says "Your pick": on your
   own post there is only one thing a pick could be about, and here there are
   two — the post being answered, and the comment being written.

   THE NOTE LEAVES THE RULED BLOCK. Under the wash the seal draws its one fact
   with the coaching line inside the rules; `FactRow`'s seal rules enclose the
   row itself and the master has no note slot, so the same words stand directly
   beneath the block as the `QuietNote` they always were. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="Leave — the reply is discarded" stageLabel="Last step" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Reply to "The long way home" — 89 characters.</QuietNote>
        <ActsCard total="1 signed action" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow
            label="Toward what you answer"
            value={<StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />}
            last
          />
        </div>
        <QuietNote>Replying also signs where you stand on the post it answers.</QuietNote>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Sign comment</Button>
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

        {/* The pick's readout, above the field where a thumb cannot cover it:
            what the pick is toward, then the face and the pair under it. The
            readout clears the corner the "?" sits in. */}
        <div style={{ display: "flex", flexDirection: "column", paddingRight: 40 }}>
          <span aria-hidden="true" style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            Toward "The long way home"
          </span>
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🙂</span>
            <span style={{ fontSize: "var(--text-body-small)", whiteSpace: "nowrap" }}>+0.10 / +0.10</span>
          </span>
          <span style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
            Nice, For or against +0.10, How much reaches you +0.10
          </span>
        </div>

        <div role="group" aria-label="Stance pad for the post you answer" style={{ alignSelf: "center", width: 240 }}>
          <StancePad value={{ pDirected: 0.1, pInterest: 0.1 }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text" size="sm">Cancel</Button>
          <Button size="sm">Set</Button>
        </div>
      </div>
    </>
  );
}
