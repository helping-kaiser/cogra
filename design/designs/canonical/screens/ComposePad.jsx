/* THE PAD ON YOUR OWN POST'S SEAL: what the seal's "Adjust" opens. The wash
   covers the seal; only the parked pad is live, which is what the board's
   `scanExempt` line says.

   THE FIELD IS ONE AXIS, the master `AttachmentPad` (jakob 2026-10-16,
   PR-101). Publishing signs one record toward the post, a Publish, and the
   census gives it one free parameter: the author's attachment — their
   BACKING — For or Against, with the second number pinned at 1, never a
   choice, so never drawn as one. The strip is the square's own language cut
   to that one axis, at the width the square would take here, the knob where
   +0.10 puts it — the gentle default every post starts from (post.md §1).
   The pick is the record; with nothing standing yet it is also the result,
   so one readout suffices.

   WHAT THE AUTHOR THINKS OF THE POST IS ANOTHER RECORD. Once the post is out,
   its face takes an ordinary opinion like anyone's — both numbers, a bundle
   of its own that never nets with this one (`PadStanding`). This pad is the
   authoring gesture alone: backing, never opinion.

   EVERYTHING AROUND THE FIELD IS THE SEAL-SCALE PAD'S GRAMMAR: the "?" in the
   top-right corner out of the readouts' reading order (`HelpDot`), opening the
   pad's named dialog over the seal; the pick's readout ABOVE the field where a
   thumb cannot cover it, reading `Your pick`; and Cancel · Set — release never
   commits, Set puts the pick back on the seal's row, and Sign and publish
   signs it with the post. The readout is the master's (`AttachmentStanding`),
   its face `VALENCE_SIX`'s, and its polite live region speaks the pick once
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
          <HelpDot ariaLabel="Your backing on your post" />
        </span>

        {/* The pick's readout, clearing the corner the "?" sits in. */}
        <AttachmentStanding pick={0.1} style={{ paddingRight: 40 }} />

        <div role="group" aria-label="Backing pad for your own post" style={{ alignSelf: "stretch" }}>
          <AttachmentPad value={0.1} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text" size="sm">Cancel</Button>
          <Button size="sm">Set</Button>
        </div>
      </div>
    </>
  );
}
