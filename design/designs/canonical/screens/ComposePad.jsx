/* THE OPINION PAD ON YOUR OWN POST: what the seal's "Adjust" opens. The wash
   covers the seal; only the parked pad is live, which is what the board's
   `scanExempt` line says.

   THE FIELD IS THE MASTER, both axes (jakob 2026-10-16). An opinion on one's
   own post is an opinion like any other: for or against it, and how much of
   it reaches you, both the author's to choose — so the value space is the
   square `StancePad` draws, and the pad reads from it rather than drawing its
   own. It is the reply pad's drawing (`ReplyPadBody`) over this seal: the
   hand board's 240px field centred, the four named directions outside it, the
   knob where +0.10 / +0.10 puts it — the pad's universal default, the gentle
   one every stance starts from.

   EVERYTHING AROUND THE FIELD IS THE SEAL-SCALE PAD'S GRAMMAR: the "?" in the
   top-right corner out of the readouts' reading order (`HelpDot`), opening the
   pad's named dialog over the seal; the pick's readout ABOVE the field where a
   thumb cannot cover it, reading `Your pick` — on your own post there is one
   thing a pick could be about; and Cancel · Set — release never commits, Set
   puts the pick back on the seal's row, and Sign and publish signs it with the
   post. The readout is the master's polite live region: the pick speaks once
   it rests.

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody`, the same body
   `ComposeSeal` draws. What a wash covers is inert, not shortened. */
export function Screen() {
  return (
    <>
      <ComposeSealBody />

      {/* The wash over the shell; the parked pad above it stays sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />

      <div
        style={{
          position: "absolute",
          left: 30,
          right: 30,
          bottom: 16,
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

        {/* The pick's readout: the name of the quantity, then the face and the
            pair under it, clearing the corner the "?" sits in. */}
        <div aria-live="polite" style={{ display: "flex", flexDirection: "column", paddingRight: 40 }}>
          <span aria-hidden="true" style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            Your pick
          </span>
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🙂</span>
            <span className="cg-exact" style={{ fontSize: "var(--text-body-small)", whiteSpace: "nowrap" }}>+0.10 / +0.10</span>
          </span>
          <span style={SR_ONLY}>
            Nice, For or against +0.10, How much reaches you +0.10
          </span>
        </div>

        <div role="group" aria-label="Opinion pad for your own post" style={{ alignSelf: "stretch" }}>
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
